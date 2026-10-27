import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BookingExpiryService, SweepResult } from './booking-expiry.service';

/** Cada cuánto corre el barrido si no se define `BOOKING_SWEEP_INTERVAL_MS`. */
export const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
export const SWEEP_INTERVAL_NAME = 'booking-expiry-sweep';

/**
 * Corre `BookingExpiryService.sweep` cada `BOOKING_SWEEP_INTERVAL_MS` (RE-06). `BOOKING_SWEEP_ENABLED=false` la
 * apaga; los e2e la apagan en `test/utils/setup-env.ts`. El intervalo se registra en el `SchedulerRegistry` de
 * `@nestjs/schedule` porque su duración sale de la configuración y `@Interval` solo acepta una constante.
 */
@Injectable()
export class BookingExpiryScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryScheduler.name);
  // El barrido en curso, o nulo si no hay ninguno. Nunca se rechaza: `run` atrapa los errores.
  private current: Promise<SweepResult | null> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly expiry: BookingExpiryService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('BOOKING_SWEEP_ENABLED') === 'false') {
      this.logger.log('Vencimientos automáticos apagados (BOOKING_SWEEP_ENABLED=false)');
      return;
    }
    const intervalMs = Number(this.config.get('BOOKING_SWEEP_INTERVAL_MS') ?? DEFAULT_SWEEP_INTERVAL_MS);
    const handle = setInterval(() => void this.tick(), intervalMs);
    // No mantiene vivo el proceso por sí solo.
    handle.unref();
    this.registry.addInterval(SWEEP_INTERVAL_NAME, handle);
    this.logger.log(`Vencimientos automáticos cada ${intervalMs} ms`);
  }

  /** Quita el intervalo y espera el barrido en curso, para que Prisma no se desconecte a mitad de uno. */
  async onModuleDestroy() {
    if (this.registry.doesExist('interval', SWEEP_INTERVAL_NAME)) {
      this.registry.deleteInterval(SWEEP_INTERVAL_NAME);
    }
    await this.current;
  }

  /** Un barrido. Si el anterior sigue corriendo, este se salta; un error se registra y no detiene el intervalo. */
  tick(now = new Date()): Promise<SweepResult | null> {
    if (this.current) return Promise.resolve(null);
    const run = this.run(now).finally(() => {
      this.current = null;
    });
    this.current = run;
    return run;
  }

  private async run(now: Date): Promise<SweepResult | null> {
    try {
      const result = await this.expiry.sweep(now);
      const { finished, expired } = result;
      if (finished.changed + expired.changed + finished.failed + expired.failed > 0) {
        this.logger.log(
          `Barrido: ${finished.changed} finalizadas, ${expired.changed} expiradas, ` +
            `${finished.failed + expired.failed} con error`,
        );
      }
      return result;
    } catch (error) {
      this.logger.error('Falló el barrido de vencimientos', error instanceof Error ? error.stack : error);
      return null;
    }
  }
}

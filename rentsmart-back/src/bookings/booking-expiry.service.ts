import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStateService } from './booking-state.service';

/** Cuántas reservas vencidas se leen por consulta en el barrido. */
export const SWEEP_BATCH_SIZE = 100;

/** Motivos que quedan en el `BookingEvent` de cada cambio automático (con `actorId` nulo). */
export const FINISHED_REASON = 'Sistema: terminó el horario de la reserva';
export const EXPIRED_REASON = 'Sistema: venció el plazo de pago sin recibir el pago';

/** Resultado de un barrido: cambiadas, saltadas (otro cambio llegó primero) y fallidas (error inesperado). */
export interface SweepCount {
  changed: number;
  skipped: number;
  failed: number;
}

export interface SweepResult {
  finished: SweepCount;
  expired: SweepCount;
}

/** Una transición automática: desde qué estado, a cuál, cuándo vence y con qué motivo. */
interface ExpiryRule {
  from: BookingStatus;
  to: BookingStatus;
  reason: string;
  due: (now: Date) => Prisma.BookingWhereInput;
}

// El límite cuenta como vencido: el rango de una reserva es [startAt, endAt) y el plazo de pago termina en expiresAt.
const FINISH: ExpiryRule = {
  from: BookingStatus.CONFIRMED,
  to: BookingStatus.FINISHED,
  reason: FINISHED_REASON,
  due: (now) => ({ endAt: { lte: now } }),
};
// Una PENDING sin expiresAt no tiene plazo conocido y no se toca.
const EXPIRE: ExpiryRule = {
  from: BookingStatus.PENDING,
  to: BookingStatus.EXPIRED,
  reason: EXPIRED_REASON,
  due: (now) => ({ expiresAt: { lte: now } }),
};

/**
 * Vencimientos automáticos (RE-06): `CONFIRMED` cuyo horario terminó → `FINISHED`, y `PENDING` cuyo plazo de pago
 * pasó → `EXPIRED`. Cada cambio pasa por `BookingStateService.transition`, condicionado al estado de origen: si el
 * webhook pagó la reserva entre la búsqueda y el cambio, esa reserva se salta y el barrido sigue con las demás.
 */
@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: BookingStateService,
  ) {}

  /**
   * Barrido completo con la hora `now`. Lee las reservas vencidas por lotes y cambia cada una en su propia
   * transacción, así un error en una no deshace ni corta las demás. Correrlo dos veces no cambia nada más.
   */
  async sweep(now: Date, batchSize = SWEEP_BATCH_SIZE): Promise<SweepResult> {
    const finished = await this.sweepRule(FINISH, now, batchSize);
    const expired = await this.sweepRule(EXPIRE, now, batchSize);
    return { finished, expired };
  }

  /**
   * Expira, dentro de la transacción `tx` de quien llama, las `PENDING` vencidas (de un espacio, si se pasa
   * `spaceId`). RE-02 la llama antes de insertar, porque una pendiente vencida sigue contando para
   * `booking_no_overlap`. Una reserva que otro cambio ganó se salta; un error inesperado se propaga, porque la
   * transacción ya no sirve.
   */
  async expireStalePending(tx: Prisma.TransactionClient, now: Date, spaceId?: string): Promise<SweepCount> {
    const due = await tx.booking.findMany({
      where: { status: EXPIRE.from, ...EXPIRE.due(now), ...(spaceId ? { spaceId } : {}) },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const count = emptyCount();
    for (const { id } of due) {
      count[await this.apply(EXPIRE, id, tx)] += 1;
    }
    return count;
  }

  private async sweepRule(rule: ExpiryRule, now: Date, batchSize: number): Promise<SweepCount> {
    const count = emptyCount();
    // Se avanza por id (keyset): una reserva que falla queda atrás y no se vuelve a leer en este barrido.
    let after: string | undefined;
    for (;;) {
      const batch = await this.prisma.booking.findMany({
        where: { status: rule.from, ...rule.due(now), ...(after ? { id: { gt: after } } : {}) },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      for (const { id } of batch) {
        try {
          count[await this.apply(rule, id)] += 1;
        } catch (error) {
          count.failed += 1;
          this.logger.error(`No se pudo pasar la reserva ${id} a ${rule.to}`, error instanceof Error ? error.stack : error);
        }
      }
      if (batch.length < batchSize) return count;
      after = batch[batch.length - 1].id;
    }
  }

  /** Aplica la transición. 409 (otro cambio ganó) o 404 (ya no existe) cuentan como saltada; lo demás se propaga. */
  private async apply(rule: ExpiryRule, id: string, tx?: Prisma.TransactionClient): Promise<'changed' | 'skipped'> {
    try {
      await this.state.transition(id, rule.to, { actorId: null, reason: rule.reason }, tx);
      return 'changed';
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        this.logger.debug(`Reserva ${id} no pasó a ${rule.to}: ${error.message}`);
        return 'skipped';
      }
      throw error;
    }
  }
}

function emptyCount(): SweepCount {
  return { changed: 0, skipped: 0, failed: 0 };
}

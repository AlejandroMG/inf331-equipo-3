import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BookingExpiryScheduler, DEFAULT_SWEEP_INTERVAL_MS, SWEEP_INTERVAL_NAME } from './booking-expiry.scheduler';
import { BookingExpiryService, SweepResult } from './booking-expiry.service';

const NOW = new Date('2026-10-24T15:00:00.000Z');
const NOTHING: SweepResult = {
  finished: { changed: 0, skipped: 0, failed: 0 },
  expired: { changed: 0, skipped: 0, failed: 0 },
};

describe('BookingExpiryScheduler', () => {
  let registry: SchedulerRegistry;
  let errorLog: jest.SpyInstance;
  const expiry = { sweep: jest.fn() };

  const scheduler = (env: Record<string, unknown>) =>
    new BookingExpiryScheduler(
      new ConfigService(env),
      registry,
      expiry as unknown as BookingExpiryService,
    );

  // `ConfigService.get` también lee process.env: sin esto, una variable del entorno cambiaría los tests.
  const ENV_KEYS = ['BOOKING_SWEEP_ENABLED', 'BOOKING_SWEEP_INTERVAL_MS'] as const;
  let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      if (key in process.env) savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    jest.useFakeTimers({ now: NOW });
    expiry.sweep.mockReset();
    expiry.sweep.mockResolvedValue(NOTHING);
    registry = new SchedulerRegistry();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    registry.getIntervals().forEach((name) => registry.deleteInterval(name));
    jest.useRealTimers();
    jest.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it('con BOOKING_SWEEP_ENABLED=false no registra ningún temporizador', () => {
    scheduler({ BOOKING_SWEEP_ENABLED: 'false' }).onApplicationBootstrap();

    expect(registry.getIntervals()).toEqual([]);
    jest.advanceTimersByTime(10 * DEFAULT_SWEEP_INTERVAL_MS);
    expect(expiry.sweep).not.toHaveBeenCalled();
  });

  it('encendida por defecto: barre cada minuto con la hora actual', async () => {
    scheduler({}).onApplicationBootstrap();

    expect(registry.getIntervals()).toEqual([SWEEP_INTERVAL_NAME]);
    await jest.advanceTimersByTimeAsync(DEFAULT_SWEEP_INTERVAL_MS - 1);
    expect(expiry.sweep).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(expiry.sweep).toHaveBeenCalledWith(new Date(NOW.getTime() + DEFAULT_SWEEP_INTERVAL_MS));
    await jest.advanceTimersByTimeAsync(DEFAULT_SWEEP_INTERVAL_MS);
    expect(expiry.sweep).toHaveBeenCalledTimes(2);
  });

  it('usa el intervalo de BOOKING_SWEEP_INTERVAL_MS', async () => {
    scheduler({ BOOKING_SWEEP_ENABLED: 'true', BOOKING_SWEEP_INTERVAL_MS: 5000 }).onApplicationBootstrap();

    await jest.advanceTimersByTimeAsync(15_000);

    expect(expiry.sweep).toHaveBeenCalledTimes(3);
  });

  it('al cerrar el módulo quita el temporizador', async () => {
    const task = scheduler({});
    task.onApplicationBootstrap();

    await task.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10 * DEFAULT_SWEEP_INTERVAL_MS);

    expect(registry.getIntervals()).toEqual([]);
    expect(expiry.sweep).not.toHaveBeenCalled();
    // Apagada, cerrar no falla.
    await expect(scheduler({ BOOKING_SWEEP_ENABLED: 'false' }).onModuleDestroy()).resolves.toBeUndefined();
  });

  it('al cerrar el módulo espera a que termine el barrido en curso', async () => {
    let finish!: (result: SweepResult) => void;
    expiry.sweep.mockReturnValueOnce(new Promise<SweepResult>((resolve) => (finish = resolve)));
    const task = scheduler({});
    task.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(DEFAULT_SWEEP_INTERVAL_MS);
    expect(expiry.sweep).toHaveBeenCalledTimes(1);

    let closed = false;
    const closing = task.onModuleDestroy().then(() => (closed = true));
    await jest.advanceTimersByTimeAsync(0);
    expect(closed).toBe(false);

    finish(NOTHING);
    await closing;
    expect(closed).toBe(true);
    expect(registry.getIntervals()).toEqual([]);
  });

  it('no empieza un barrido mientras el anterior sigue corriendo', async () => {
    let finish!: (result: SweepResult) => void;
    expiry.sweep.mockReturnValueOnce(new Promise<SweepResult>((resolve) => (finish = resolve)));
    const task = scheduler({});

    const first = task.tick();
    await expect(task.tick()).resolves.toBeNull();
    finish(NOTHING);

    await expect(first).resolves.toEqual(NOTHING);
    expect(expiry.sweep).toHaveBeenCalledTimes(1);
    await expect(task.tick()).resolves.toEqual(NOTHING);
  });

  it('si un barrido falla, lo registra y el siguiente corre igual', async () => {
    expiry.sweep.mockRejectedValueOnce(new Error('base caída'));
    const task = scheduler({});

    await expect(task.tick(NOW)).resolves.toBeNull();
    expect(errorLog).toHaveBeenCalledTimes(1);

    await expect(task.tick(NOW)).resolves.toEqual(NOTHING);
  });
});

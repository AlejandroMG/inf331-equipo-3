import {
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiProviderError } from './ai-provider';
import type { SpaceDescriptionInput } from './ai-provider';
import { AiUsageQuotaService } from './ai-usage-quota.service';
import { SpaceDescriptionAiService } from './space-description-ai.service';

describe('SpaceDescriptionAiService', () => {
  const input: SpaceDescriptionInput = {
    name: 'Sala Alameda',
    type: 'reuniones',
    region: 'Región Metropolitana',
    commune: 'Santiago',
    address: 'Av. Grecia 1000',
    capacity: 8,
    amenities: ['Wi-Fi'],
    rules: 'No fumar',
    pricePerHour: 12000,
    pricePerDay: 80000,
    schedule: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
    photos: [],
  };
  const quota = {
    reserve: jest.fn(),
    markSucceeded: jest.fn(),
    saveFallback: jest.fn(),
  };
  const provider = {
    source: 'gemini',
    generateSpaceDescription: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue(15_000) };
  let service: SpaceDescriptionAiService;
  let logWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    quota.reserve.mockResolvedValue({
      attemptId: 'attempt-1',
      attemptsUsed: 1,
    });
    quota.markSucceeded.mockResolvedValue(undefined);
    quota.saveFallback.mockResolvedValue(undefined);
    provider.generateSpaceDescription.mockResolvedValue('Una sala luminosa.');
    logWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    service = new SpaceDescriptionAiService(
      quota as unknown as AiUsageQuotaService,
      provider as unknown as AiProvider,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    logWarn.mockRestore();
    jest.useRealTimers();
  });

  it('reserva el espacio y marca una generación exitosa', async () => {
    await expect(service.generate('user-1', 'space-1', input)).resolves.toEqual(
      {
        description: 'Una sala luminosa.',
        source: 'gemini',
        attemptsUsed: 1,
      },
    );

    expect(quota.reserve).toHaveBeenCalledWith('user-1', 'space-1');
    expect(quota.markSucceeded).toHaveBeenCalledWith(
      'attempt-1',
      'Una sala luminosa.',
      'gemini',
    );
    expect(quota.saveFallback).not.toHaveBeenCalled();
    expect(provider.generateSpaceDescription).toHaveBeenCalledWith(
      input,
      expect.any(AbortSignal),
    );
  });

  it('devuelve respaldo y libera el espacio para reintentar si el proveedor falla', async () => {
    provider.generateSpaceDescription.mockRejectedValue(
      new AiProviderError('Gemini respondió con estado 503'),
    );

    await expect(service.generate('user-1', 'space-1', input)).resolves.toEqual(
      {
        description:
          'Se arrienda reuniones "Sala Alameda" en Av. Grecia 1000, Santiago, Región Metropolitana, con capacidad para 8 personas. Cuenta con Wi-Fi. Entre las reglas del espacio se indica: No fumar. El valor es $12.000 por hora y $80.000 por día. Está disponible los lunes de 09:00 a 18:00.',
        source: 'fallback',
        attemptsUsed: 1,
      },
    );
    expect(quota.saveFallback).toHaveBeenCalledWith(
      'attempt-1',
      expect.stringContaining('Se arrienda reuniones "Sala Alameda"'),
    );
    expect(quota.markSucceeded).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      'Proveedor de IA no disponible (Gemini respondió con estado 503); se devuelve una descripción de respaldo',
    );
  });

  it('aborta por timeout, libera el espacio y devuelve respaldo', async () => {
    jest.useFakeTimers();
    provider.generateSpaceDescription.mockImplementation(
      () => new Promise<string>(() => undefined),
    );

    const result = service.generate('user-1', 'space-1', input);
    await jest.advanceTimersByTimeAsync(15_000);

    await expect(result).resolves.toMatchObject({ source: 'fallback' });
    expect(provider.generateSpaceDescription.mock.calls[0][1].aborted).toBe(
      true,
    );
    expect(quota.saveFallback).toHaveBeenCalledWith(
      'attempt-1',
      expect.any(String),
    );
  });

  it('propaga el límite diario sin llamar al proveedor', async () => {
    quota.reserve.mockRejectedValue(
      new HttpException('quota exceeded', HttpStatus.TOO_MANY_REQUESTS),
    );

    await expect(
      service.generate('user-1', 'space-1', input),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(provider.generateSpaceDescription).not.toHaveBeenCalled();
  });

  it('propaga que ese espacio ya tiene una descripción generada', async () => {
    quota.reserve.mockRejectedValue(new ConflictException('already generated'));

    await expect(
      service.generate('user-1', 'space-1', input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(provider.generateSpaceDescription).not.toHaveBeenCalled();
  });

  it('rechaza peticiones sin usuario autenticado', async () => {
    await expect(service.generate('', 'space-1', input)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(quota.reserve).not.toHaveBeenCalled();
  });
});

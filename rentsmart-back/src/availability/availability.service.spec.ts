import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { scheduleError, sortRules } from './schedule-rules';

const rule = (weekday: number, startTime: string, endTime: string) => ({ weekday, startTime, endTime });

describe('schedule-rules', () => {
  it('ordena por día y hora de inicio', () => {
    expect(sortRules([rule(2, '09:00', '10:00'), rule(1, '15:00', '18:00'), rule(1, '09:00', '13:00')])).toEqual([
      rule(1, '09:00', '13:00'),
      rule(1, '15:00', '18:00'),
      rule(2, '09:00', '10:00'),
    ]);
  });

  it.each([
    ['un horario vacío', []],
    ['un rango de una hora', [rule(1, '09:00', '10:00')]],
    ['el día completo, hasta las 24:00', [rule(0, '00:00', '24:00')]],
    ['dos rangos contiguos', [rule(1, '09:00', '13:00'), rule(1, '13:00', '18:00')]],
    ['contiguos hasta las 24:00, en desorden', [rule(1, '20:00', '24:00'), rule(1, '09:00', '20:00')]],
    ['las mismas horas en días distintos', [rule(1, '09:00', '13:00'), rule(2, '09:00', '13:00')]],
  ])('vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBeNull();
  });

  it.each([
    ['un fin igual al inicio', [rule(1, '09:00', '09:00')]],
    ['un fin anterior al inicio', [rule(1, '12:00', '09:00')]],
  ])('no vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBe('El fin de cada rango debe ser posterior a su inicio');
  });

  it.each([
    ['dos rangos que se cruzan una hora', [rule(1, '09:00', '13:00'), rule(1, '12:00', '18:00')]],
    ['un rango dentro de otro', [rule(1, '09:00', '18:00'), rule(1, '11:00', '12:00')]],
    ['el mismo rango dos veces', [rule(3, '09:00', '10:00'), rule(3, '09:00', '10:00')]],
    ['un cruce con las 24:00, en desorden', [rule(6, '22:00', '24:00'), rule(6, '09:00', '23:00')]],
  ])('no vale %s', (_name, rules) => {
    expect(scheduleError(rules)).toBe('Los rangos de un mismo día no pueden traslaparse');
  });
});

describe('AvailabilityService (horario semanal)', () => {
  let service: AvailabilityService;
  const prisma = {
    $transaction: jest.fn(),
    space: { findUnique: jest.fn() },
    availabilityRule: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const space = (status: string, ownerId = 'owner') => prisma.space.findUnique.mockResolvedValue({ ownerId, status });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    prisma.availabilityRule.deleteMany.mockReturnValue('borrar');
    prisma.availabilityRule.createMany.mockReturnValue('crear');
    const module = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AvailabilityService);
  });

  describe('findSchedule', () => {
    it('devuelve las reglas del espacio por día y hora de inicio', async () => {
      space('DRAFT');
      prisma.availabilityRule.findMany.mockResolvedValue([rule(1, '09:00', '21:00')]);

      await expect(service.findSchedule('owner', 's1')).resolves.toEqual({ rules: [rule(1, '09:00', '21:00')] });
      expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith({
        where: { spaceId: 's1' },
        select: { weekday: true, startTime: true, endTime: true },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('responde 404 si el espacio no existe y 403 si es de otro', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(service.findSchedule('owner', 's1')).rejects.toThrow(NotFoundException);

      space('ACTIVE', 'otro');
      await expect(service.findSchedule('owner', 's1')).rejects.toThrow(ForbiddenException);
      expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceSchedule', () => {
    it('reemplaza el horario completo en una transacción y lo devuelve ordenado', async () => {
      space('ACTIVE');
      const rules = [rule(1, '13:00', '24:00'), rule(0, '10:00', '14:00'), rule(1, '09:00', '13:00')];

      const saved = await service.replaceSchedule('owner', 's1', { rules });

      const sorted = [rule(0, '10:00', '14:00'), rule(1, '09:00', '13:00'), rule(1, '13:00', '24:00')];
      expect(saved).toEqual({ rules: sorted });
      expect(prisma.availabilityRule.deleteMany).toHaveBeenCalledWith({ where: { spaceId: 's1' } });
      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({
        data: sorted.map((item) => ({ ...item, spaceId: 's1' })),
      });
      expect(prisma.$transaction).toHaveBeenCalledWith(['borrar', 'crear']);
    });

    it('no guarda campos de más que vengan en una regla', async () => {
      space('DRAFT');
      const dirty = { ...rule(1, '09:00', '10:00'), spaceId: 'otro-espacio' };

      await service.replaceSchedule('owner', 's1', { rules: [dirty] });

      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({
        data: [{ ...rule(1, '09:00', '10:00'), spaceId: 's1' }],
      });
    });

    it.each([
      ['un fin que no es posterior al inicio', [rule(1, '10:00', '10:00')]],
      ['rangos que se traslapan', [rule(1, '09:00', '13:00'), rule(1, '12:00', '18:00')]],
    ])('responde 400 con %s y no cambia nada', async (_name, rules) => {
      space('DRAFT');

      await expect(service.replaceSchedule('owner', 's1', { rules })).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('responde 409 con missing si deja sin horario a un espacio publicado', async () => {
      space('ACTIVE');

      const error = await service.replaceSchedule('owner', 's1', { rules: [] }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ statusCode: 409, missing: ['schedule'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(['DRAFT', 'INACTIVE', 'BLOCKED'])('un espacio %s sí puede quedar sin horario', async (status) => {
      space(status);

      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).resolves.toEqual({ rules: [] });
      expect(prisma.availabilityRule.createMany).toHaveBeenCalledWith({ data: [] });
    });

    it('responde 404 si el espacio no existe y 403 si es de otro, sin cambiar nada', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).rejects.toThrow(NotFoundException);

      space('DRAFT', 'otro');
      await expect(service.replaceSchedule('owner', 's1', { rules: [] })).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

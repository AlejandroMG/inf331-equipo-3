import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { IncompleteSpaceException } from './incomplete-space.exception';
import { PublicationService } from './publication.service';
import { SpacesService } from './spaces.service';

const complete = {
  ownerId: 'u1',
  status: 'DRAFT',
  typeId: 1,
  description: 'Sala',
  capacity: 8,
  communeId: 2,
  pricePerHour: 9000,
  pricePerDay: null,
  _count: { photos: 1, rulesWeek: 5 },
};

describe('PublicationService', () => {
  let service: PublicationService;
  const tx = {
    space: { updateMany: jest.fn() },
    user: { update: jest.fn() },
  };
  const prisma = {
    space: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const spaces = { findOne: jest.fn() };

  const given = (patch: Record<string, unknown> = {}) =>
    prisma.space.findUnique.mockResolvedValue({ ...complete, ...patch });

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.space.updateMany.mockResolvedValue({ count: 1 });
    spaces.findOne.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    const module = await Test.createTestingModule({
      providers: [
        PublicationService,
        { provide: PrismaService, useValue: prisma },
        { provide: SpacesService, useValue: spaces },
      ],
    }).compile();
    service = module.get(PublicationService);
  });

  describe('publish', () => {
    it('lanza 404 si no existe y 403 si es de otro', async () => {
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(service.publish('u1', 'x')).rejects.toThrow(NotFoundException);

      given({ ownerId: 'otro' });
      await expect(service.publish('u1', 's1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('publica un borrador completo y habilita a la cuenta como propietaria', async () => {
      given();

      await service.publish('u1', 's1');

      expect(tx.space.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', status: 'DRAFT' },
        data: { status: 'ACTIVE' },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isHost: true },
      });
    });

    it('si falta algo responde 409 con la lista y no cambia nada', async () => {
      given({ _count: { photos: 0, rulesWeek: 0 }, pricePerHour: null });

      const error = await service.publish('u1', 's1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(IncompleteSpaceException);
      expect((error as IncompleteSpaceException).missing).toEqual([
        'price',
        'photos',
        'schedule',
      ]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['ACTIVE', ConflictException],
      ['INACTIVE', ConflictException],
      ['BLOCKED', ForbiddenException],
    ])('un espacio %s no se publica', async (status, expected) => {
      given({ status });

      await expect(service.publish('u1', 's1')).rejects.toThrow(expected);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('si otra petición cambió el estado antes, responde 409 y no habilita a la cuenta', async () => {
      given();
      tx.space.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.publish('u1', 's1')).rejects.toThrow(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('desactiva un espacio activo', async () => {
      given({ status: 'ACTIVE' });

      await service.changeStatus('u1', 's1', 'INACTIVE' as never);

      expect(tx.space.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('desactivar no exige que el espacio esté completo', async () => {
      given({ status: 'ACTIVE', _count: { photos: 0, rulesWeek: 0 } });

      await expect(
        service.changeStatus('u1', 's1', 'INACTIVE' as never),
      ).resolves.toBeDefined();
    });

    it('reactiva un espacio desactivado si sigue completo', async () => {
      given({ status: 'INACTIVE' });

      await service.changeStatus('u1', 's1', 'ACTIVE' as never);

      expect(tx.space.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', status: 'INACTIVE' },
        data: { status: 'ACTIVE' },
      });
    });

    it('no reactiva un espacio desactivado que no tiene fotos', async () => {
      given({ status: 'INACTIVE', _count: { photos: 0, rulesWeek: 5 } });

      await expect(
        service.changeStatus('u1', 's1', 'ACTIVE' as never),
      ).rejects.toMatchObject({ missing: ['photos'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('no reactiva uno que quedó incompleto mientras estaba desactivado', async () => {
      given({ status: 'INACTIVE', pricePerHour: null });

      await expect(
        service.changeStatus('u1', 's1', 'ACTIVE' as never),
      ).rejects.toMatchObject({ missing: ['price'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(['ACTIVE', 'INACTIVE'])(
      'pedir el estado que ya tiene (%s) no cambia nada',
      async (status) => {
        given({ status });

        await service.changeStatus('u1', 's1', status as never);

        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it.each(['ACTIVE', 'INACTIVE'])(
      'un borrador no se pasa a %s por aquí',
      async (target) => {
        given({ status: 'DRAFT' });

        await expect(
          service.changeStatus('u1', 's1', target as never),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('un espacio bloqueado por un admin no se toca', async () => {
      given({ status: 'BLOCKED' });

      await expect(
        service.changeStatus('u1', 's1', 'ACTIVE' as never),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.changeStatus('u1', 's1', 'INACTIVE' as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza 403 si el espacio es de otro', async () => {
      given({ ownerId: 'otro' });

      await expect(
        service.changeStatus('u1', 's1', 'INACTIVE' as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

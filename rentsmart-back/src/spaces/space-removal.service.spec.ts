import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SpaceRemovalService } from './space-removal.service';

describe('SpaceRemovalService', () => {
  let service: SpaceRemovalService;
  const prisma = {
    space: { findUnique: jest.fn(), delete: jest.fn() },
  };
  const storage = { upload: jest.fn(), remove: jest.fn() };

  const space = (overrides: Record<string, unknown> = {}) => ({
    ownerId: 'u1',
    status: 'ACTIVE',
    photos: [{ storagePath: 'spaces/s1/a.jpg' }, { storagePath: 'spaces/s1/b.jpg' }],
    _count: { bookings: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SpaceRemovalService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(SpaceRemovalService);
  });

  it('elimina un espacio propio sin reservas y borra sus fotos del almacenamiento', async () => {
    prisma.space.findUnique.mockResolvedValue(space());

    await service.remove('u1', 's1');

    expect(prisma.space.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(storage.remove).toHaveBeenCalledWith('spaces/s1/a.jpg');
    expect(storage.remove).toHaveBeenCalledWith('spaces/s1/b.jpg');
  });

  it('elimina también un borrador', async () => {
    prisma.space.findUnique.mockResolvedValue(space({ status: 'DRAFT', photos: [] }));

    await service.remove('u1', 's1');

    expect(prisma.space.delete).toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('responde 404 si el espacio no existe', async () => {
    prisma.space.findUnique.mockResolvedValue(null);

    await expect(service.remove('u1', 's1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.space.delete).not.toHaveBeenCalled();
  });

  it('responde 403 si el espacio es de otro usuario', async () => {
    prisma.space.findUnique.mockResolvedValue(space({ ownerId: 'otro' }));

    await expect(service.remove('u1', 's1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.space.delete).not.toHaveBeenCalled();
  });

  it('responde 403 si un administrador lo bloqueó', async () => {
    prisma.space.findUnique.mockResolvedValue(space({ status: 'BLOCKED' }));

    await expect(service.remove('u1', 's1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.space.delete).not.toHaveBeenCalled();
  });

  it('responde 409 si el espacio tiene reservas, de cualquier estado', async () => {
    prisma.space.findUnique.mockResolvedValue(space({ _count: { bookings: 1 } }));

    await expect(service.remove('u1', 's1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.space.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('traduce a 409 una reserva creada justo antes de borrar (llave foránea)', async () => {
    prisma.space.findUnique.mockResolvedValue(space());
    prisma.space.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('u1', 's1')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('no falla si no puede borrar un archivo del almacenamiento', async () => {
    prisma.space.findUnique.mockResolvedValue(space());
    storage.remove.mockRejectedValueOnce(new Error('(500)'));

    await expect(service.remove('u1', 's1')).resolves.toBeUndefined();
    expect(storage.remove).toHaveBeenCalledTimes(2);
  });
});

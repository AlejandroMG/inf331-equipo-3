import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService.register', () => {
  const dto = {
    email: 'ana@rentsmart.test',
    password: 'Password123',
    name: 'Ana',
  };

  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('crea el usuario con la contraseña hasheada', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u1', email: data.email, name: data.name }),
    );

    const user = await service.register(dto);

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.passwordHash).not.toBe(dto.password);
    await expect(bcrypt.compare(dto.password, data.passwordHash)).resolves.toBe(
      true,
    );
    expect(user).toEqual({ id: 'u1', email: dto.email, name: dto.name });
  });

  it('no pide el passwordHash en la respuesta', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u1' });

    await service.register(dto);

    const { select } = prisma.user.create.mock.calls[0][0];
    expect(select.passwordHash).toBeUndefined();
    expect(select.email).toBe(true);
  });

  it('rechaza un email ya registrado con 409', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existente' });

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('traduce a 409 el choque del índice único (registros simultáneos)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deja pasar otros errores de la base de datos', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(new Error('conexión perdida'));

    await expect(service.register(dto)).rejects.toThrow('conexión perdida');
  });
});

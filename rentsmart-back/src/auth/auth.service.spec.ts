import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_SUSPENDED,
  AuthService,
  INVALID_CREDENTIALS,
} from './auth.service';

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
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
    );
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

describe('AuthService.login', () => {
  const password = 'Password123';
  let passwordHash: string;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  const storedUser = (overrides: object = {}) => ({
    id: 'u1',
    email: 'ana@rentsmart.test',
    name: 'Ana',
    role: 'USER',
    isHost: false,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    passwordHash,
    status: 'ACTIVE',
    ...overrides,
  });

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('token-firmado') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  it('devuelve el token y el usuario sin datos sensibles', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser());

    const result = await service.login({
      email: 'ana@rentsmart.test',
      password,
    });

    expect(result.accessToken).toBe('token-firmado');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', role: 'USER' });
    expect(result.user).toEqual({
      id: 'u1',
      email: 'ana@rentsmart.test',
      name: 'Ana',
      role: 'USER',
      isHost: false,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
  });

  it('rechaza una contraseña incorrecta con 401', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser());

    const attempt = service.login({
      email: 'ana@rentsmart.test',
      password: 'otra-clave',
    });

    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toThrow(INVALID_CREDENTIALS);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('responde igual si el email no existe (no revela qué emails tienen cuenta)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nadie@rentsmart.test', password }),
    ).rejects.toThrow(INVALID_CREDENTIALS);
  });

  it('bloquea a un usuario suspendido con 403', async () => {
    prisma.user.findUnique.mockResolvedValue(
      storedUser({ status: 'SUSPENDED' }),
    );

    const attempt = service.login({ email: 'ana@rentsmart.test', password });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toThrow(ACCOUNT_SUSPENDED);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('no revela la suspensión a quien no sabe la contraseña', async () => {
    prisma.user.findUnique.mockResolvedValue(
      storedUser({ status: 'SUSPENDED' }),
    );

    await expect(
      service.login({ email: 'ana@rentsmart.test', password: 'otra-clave' }),
    ).rejects.toThrow(INVALID_CREDENTIALS);
  });
});

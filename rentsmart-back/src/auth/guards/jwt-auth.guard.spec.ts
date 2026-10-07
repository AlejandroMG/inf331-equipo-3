import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'x'.repeat(32);

function contextWith(authorization?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  const findUnique = jest.fn();
  const guard = new JwtAuthGuard(jwt, {
    user: { findUnique },
  } as unknown as PrismaService);

  const tokenFor = (sub: string) => jwt.sign({ sub, role: 'USER' });

  beforeEach(() => jest.resetAllMocks());

  it('con un token válido deja el usuario en request.user', async () => {
    findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN', status: 'ACTIVE' });
    const { context, request } = contextWith(`Bearer ${tokenFor('u1')}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    // El rol sale de la base (ADMIN), no del token (USER).
    expect(request.user).toEqual({ id: 'u1', role: 'ADMIN' });
  });

  it.each([
    ['sin encabezado', undefined],
    ['con otro esquema', 'Basic abc'],
    ['con "Bearer" sin token', 'Bearer'],
    ['con un token mal formado', 'Bearer no-es-un-jwt'],
  ])('responde 401 %s', async (_caso, header) => {
    await expect(
      guard.canActivate(contextWith(header).context),
    ).rejects.toThrow(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('responde 401 con un token firmado con otro secreto', async () => {
    const forged = new JwtService({ secret: 'y'.repeat(32) }).sign({
      sub: 'u1',
      role: 'ADMIN',
    });

    await expect(
      guard.canActivate(contextWith(`Bearer ${forged}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 con un token expirado', async () => {
    const expired = jwt.sign({ sub: 'u1', role: 'USER' }, { expiresIn: -10 });

    await expect(
      guard.canActivate(contextWith(`Bearer ${expired}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 si el usuario ya no existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextWith(`Bearer ${tokenFor('u1')}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('responde 401 si la cuenta fue suspendida después de iniciar sesión', async () => {
    findUnique.mockResolvedValue({
      id: 'u1',
      role: 'USER',
      status: 'SUSPENDED',
    });

    await expect(
      guard.canActivate(contextWith(`Bearer ${tokenFor('u1')}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });
});

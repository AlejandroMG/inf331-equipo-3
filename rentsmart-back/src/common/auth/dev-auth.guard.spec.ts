import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEV_USER_EMAIL, DevAuthGuard } from './dev-auth.guard';

function contextWith(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return { context, request };
}

describe('DevAuthGuard', () => {
  const findUnique = jest.fn();
  const guard = new DevAuthGuard({
    user: { findUnique },
  } as unknown as PrismaService);
  const env = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = env;
  });

  it('identifica al usuario por x-user-id y lo deja en request.user', async () => {
    findUnique.mockResolvedValue({ id: 'u1', role: 'USER', status: 'ACTIVE' });
    const { context, request } = contextWith({ 'x-user-id': 'u1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
    expect(request.user).toEqual({ id: 'u1', role: 'USER' });
  });

  it('sin x-user-id usa el propietario del seed', async () => {
    findUnique.mockResolvedValue({ id: 'u2', role: 'USER', status: 'ACTIVE' });
    const { context, request } = contextWith({});

    await guard.canActivate(context);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: DEV_USER_EMAIL } }),
    );
    expect(request.user).toEqual({ id: 'u2', role: 'USER' });
  });

  it('responde 401 si el usuario no existe', async () => {
    findUnique.mockResolvedValue(null);
    const { context } = contextWith({ 'x-user-id': 'nadie' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('responde 401 si el usuario está suspendido', async () => {
    findUnique.mockResolvedValue({
      id: 'u3',
      role: 'USER',
      status: 'SUSPENDED',
    });
    const { context } = contextWith({ 'x-user-id': 'u3' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('nunca funciona en producción', async () => {
    process.env.NODE_ENV = 'production';
    const { context } = contextWith({ 'x-user-id': 'u1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});

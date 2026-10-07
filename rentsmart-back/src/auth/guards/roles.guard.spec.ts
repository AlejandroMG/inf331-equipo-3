import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWith(user?: { id: string; role: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  it('sin @Roles deja pasar a cualquiera con sesión', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextWith({ id: 'u1', role: 'USER' }))).toBe(
      true,
    );
  });

  it('deja pasar a un rol permitido', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(contextWith({ id: 'u1', role: 'ADMIN' }))).toBe(
      true,
    );
  });

  it('responde 403 a un rol no permitido', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() =>
      guard.canActivate(contextWith({ id: 'u1', role: 'USER' })),
    ).toThrow(ForbiddenException);
  });

  it('responde 403 si no hay usuario (falta JwtAuthGuard antes)', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(contextWith())).toThrow(ForbiddenException);
  });
});

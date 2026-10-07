import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const guard = new AdminGuard();
  const contextOf = (user?: { id: string; role: string }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('deja pasar a un administrador', () => {
    expect(guard.canActivate(contextOf({ id: 'a1', role: 'ADMIN' }))).toBe(
      true,
    );
  });

  it('rechaza con 403 a un usuario común', () => {
    expect(() =>
      guard.canActivate(contextOf({ id: 'u1', role: 'USER' })),
    ).toThrow(ForbiddenException);
  });

  it('rechaza con 403 si no hay usuario en la petición', () => {
    expect(() => guard.canActivate(contextOf())).toThrow(ForbiddenException);
  });
});

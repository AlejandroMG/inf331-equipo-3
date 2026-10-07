import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { UserRole } from '../../generated/prisma/enums';

const ROLES_KEY = 'roles';

/** Roles que pueden usar el endpoint o el controlador. Va junto a `@UseGuards(JwtAuthGuard, RolesGuard)`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Deja pasar solo a los roles de `@Roles(...)`; sin `@Roles` deja pasar a cualquiera con sesión.
 * Debe ir después de `JwtAuthGuard`, que es quien deja `request.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('No tienes permiso para hacer esto.');
    }
    return true;
  }
}

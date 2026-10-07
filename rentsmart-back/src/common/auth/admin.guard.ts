import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../generated/prisma/enums';
import { AuthUser } from './auth-user';

/**
 * Solo deja pasar a los administradores. Va después del guard de autenticación (`DevAuthGuard` hoy, el
 * `JwtAuthGuard` de A cuando llegue CU-03), que es quien deja `request.user`: `@UseGuards(DevAuthGuard, AdminGuard)`.
 * Cuando A entregue su `RolesGuard`, esto se reemplaza por `@Roles('ADMIN')` sin tocar los controladores más que ahí.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo para administradores');
    }
    return true;
  }
}

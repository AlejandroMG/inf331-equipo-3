import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from './auth-user';

/** Usuario que se usa cuando la petición no trae `x-user-id`: el propietario del seed. */
export const DEV_USER_EMAIL = 'propietario@rentsmart.test';

/**
 * Guard TEMPORAL de desarrollo, mientras A no entrega el JwtAuthGuard (CU-03).
 * Identifica al usuario por el encabezado `x-user-id` (o, sin él, el propietario del seed) y deja
 * `request.user` con la misma forma que dejará el guard real, para cambiarlo sin tocar los controladores:
 * basta reemplazar `DevAuthGuard` por `JwtAuthGuard` en cada `@UseGuards`.
 *
 * Nunca funciona en producción: cualquiera podría hacerse pasar por otro usuario.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Autenticación no disponible');
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const userId = request.headers['x-user-id'];

    const user = await this.prisma.user.findUnique({
      where:
        typeof userId === 'string' ? { id: userId } : { email: DEV_USER_EMAIL },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Usuario no válido');
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }
}

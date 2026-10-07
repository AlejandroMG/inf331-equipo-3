import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../jwt-payload';

export const SESSION_REQUIRED = 'Inicia sesión para continuar.';

/**
 * Exige un token válido en `Authorization: Bearer <token>` y deja el usuario en `request.user`,
 * de donde lo lee `@CurrentUser()`. Uso: `@UseGuards(JwtAuthGuard)` en el controlador o el endpoint.
 *
 * Además del token, revisa al usuario en la base: una cuenta borrada o suspendida después de iniciar
 * sesión pierde el acceso de inmediato, sin esperar a que el token expire.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(SESSION_REQUIRED);
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      // Firma inválida, token mal formado o expirado.
      throw new UnauthorizedException(SESSION_REQUIRED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(SESSION_REQUIRED);
    }

    // El rol se toma de la base y no del token: si un admin cambia el rol, aplica de inmediato.
    request.user = { id: user.id, role: user.role };
    return true;
  }
}

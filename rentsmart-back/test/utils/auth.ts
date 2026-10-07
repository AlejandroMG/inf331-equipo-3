import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../src/auth/jwt-payload';
import { UserRole } from '../../src/generated/prisma/enums';

/**
 * Encabezado `Authorization` con un token firmado por la API de test, como el que entrega el login.
 * El guard igual revisa al usuario en la base: un id inexistente o suspendido responde 401.
 */
export function bearer(
  app: INestApplication,
  userId: string,
  role: UserRole = 'USER',
): { Authorization: string } {
  const payload: JwtPayload = { sub: userId, role };
  return { Authorization: `Bearer ${app.get(JwtService).sign(payload)}` };
}

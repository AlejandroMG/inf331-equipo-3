import { UserRole } from '../generated/prisma/client';

/** Contenido del token de sesión. `sub` es el id del usuario. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
}

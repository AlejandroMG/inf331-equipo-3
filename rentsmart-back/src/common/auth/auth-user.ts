import { UserRole } from '../../generated/prisma/enums';

/** Usuario autenticado de la petición. Es lo que entrega `@CurrentUser()` y lo que dejará el JwtAuthGuard de A (CU-03). */
export interface AuthUser {
  id: string;
  role: UserRole;
}

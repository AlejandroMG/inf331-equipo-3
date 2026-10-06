import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload';

const BCRYPT_ROUNDS = 10;

const EMAIL_TAKEN = 'Ya existe una cuenta con este email.';
// El mismo mensaje si el email no existe o si la contraseña es incorrecta:
// así no se puede averiguar qué emails tienen cuenta.
export const INVALID_CREDENTIALS = 'Email o contraseña incorrectos.';
export const ACCOUNT_SUSPENDED =
  'Tu cuenta está suspendida. Escríbenos si crees que es un error.';

// Hash de relleno para comparar cuando el email no existe, así la respuesta tarda lo mismo.
const DUMMY_HASH = bcrypt.hashSync('rentsmart-dummy-password', BCRYPT_ROUNDS);

// Datos del usuario que se pueden devolver al cliente: nunca el passwordHash.
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isHost: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException(EMAIL_TAKEN);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
        select: publicUserSelect,
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único de la BD rechaza el segundo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true, status: true },
    });

    const passwordOk = await bcrypt.compare(
      dto.password,
      found?.passwordHash ?? DUMMY_HASH,
    );
    if (!found || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Solo se avisa de la suspensión a quien demostró conocer la contraseña.
    if (found.status === 'SUSPENDED') {
      throw new ForbiddenException(ACCOUNT_SUSPENDED);
    }

    const { passwordHash: _hash, status: _status, ...user } = found;
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}

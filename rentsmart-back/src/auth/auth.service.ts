import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

const EMAIL_TAKEN = 'Ya existe una cuenta con este email.';

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

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}

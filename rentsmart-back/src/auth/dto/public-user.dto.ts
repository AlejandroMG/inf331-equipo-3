import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/client';

/** Usuario tal como lo devuelve la API: nunca incluye la contraseña. */
export class PublicUserDto {
  @ApiProperty({ example: '6f1c2a3e-8b4d-4e5f-9a1b-2c3d4e5f6a7b' })
  id: string;

  @ApiProperty({ example: 'ana@rentsmart.test' })
  email: string;

  @ApiProperty({ example: 'Ana Pérez' })
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({
    example: false,
    description: 'true desde que publica su primer espacio',
  })
  isHost: boolean;

  @ApiProperty({ example: '2026-10-05T21:00:00.000Z' })
  createdAt: Date;
}

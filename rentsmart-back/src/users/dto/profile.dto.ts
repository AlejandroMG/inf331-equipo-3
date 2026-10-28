import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/client';

export class MyProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({ type: String, nullable: true })
  profilePhotoUrl: string | null;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  isHost: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class PublicProfileReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  authorName: string;

  @ApiProperty()
  spaceName: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ type: String, nullable: true })
  comment: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class PublicProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({ type: String, nullable: true })
  profilePhotoUrl: string | null;

  @ApiProperty({ description: 'Fecha en que creó su cuenta' })
  createdAt: Date;

  @ApiProperty({ description: 'Cantidad de reseñas recibidas en sus espacios' })
  reviewCount: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Promedio de estrellas; null si aún no tiene reseñas',
  })
  averageRating: number | null;

  @ApiProperty({ type: [PublicProfileReviewDto] })
  reviews: PublicProfileReviewDto[];
}

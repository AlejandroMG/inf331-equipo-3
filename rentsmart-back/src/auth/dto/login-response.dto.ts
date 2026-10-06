import { ApiProperty } from '@nestjs/swagger';
import { PublicUserDto } from './public-user.dto';

export class LoginResponseDto {
  @ApiProperty({
    description:
      'JWT para el header Authorization: Bearer <token>. Expira según JWT_EXPIRES_IN.',
  })
  accessToken: string;

  @ApiProperty({ type: PublicUserDto })
  user: PublicUserDto;
}

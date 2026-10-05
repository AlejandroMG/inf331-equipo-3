import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { PublicUserDto } from './dto/public-user.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Cuentas')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una cuenta con email y contraseña' })
  @ApiCreatedResponse({ type: PublicUserDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiConflictResponse({ description: 'Ya existe una cuenta con este email' })
  register(@Body() dto: RegisterDto): Promise<PublicUserDto> {
    return this.authService.register(dto);
  }
}

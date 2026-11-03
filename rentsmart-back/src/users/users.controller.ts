import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MAX_PHOTO_BYTES, UploadPhotoDto } from '../spaces/dto/photo.dto';
import { MyProfileDto, PublicProfileDto } from './dto/profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Perfiles')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el perfil privado de la sesión actual' })
  @ApiOkResponse({ type: MyProfileDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  me(@CurrentUser() user: AuthUser): Promise<MyProfileDto> {
    return this.users.me(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualiza nombre, teléfono y biografía' })
  @ApiOkResponse({ type: MyProfileDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<MyProfileDto> {
    return this.users.update(user.id, dto);
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sube o reemplaza la foto de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadPhotoDto })
  @ApiCreatedResponse({ type: MyProfileDto })
  @ApiBadRequestResponse({
    description: 'Falta la foto o su formato no es válido',
  })
  @ApiPayloadTooLargeResponse({ description: 'La foto pesa más de 5 MB' })
  uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MyProfileDto> {
    return this.users.uploadPhoto(user.id, file);
  }

  @Delete('me/photo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quita la foto de perfil' })
  @ApiOkResponse({ type: MyProfileDto })
  removePhoto(@CurrentUser() user: AuthUser): Promise<MyProfileDto> {
    return this.users.removePhoto(user.id);
  }

  @Get(':id/profile')
  @ApiOperation({
    summary:
      'Consulta un perfil público de propietario y sus reseñas recibidas',
  })
  @ApiOkResponse({ type: PublicProfileDto })
  @ApiNotFoundResponse({ description: 'El perfil público no existe' })
  publicProfile(@Param('id') id: string): Promise<PublicProfileDto> {
    return this.users.publicProfile(id);
  }
}

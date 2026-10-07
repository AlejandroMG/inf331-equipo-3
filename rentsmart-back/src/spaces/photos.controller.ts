import {
  Body,
  Controller,
  Delete,
  HttpCode,
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
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  MAX_PHOTO_BYTES,
  PhotoDto,
  ReorderPhotosDto,
  UploadPhotoDto,
} from './dto/photo.dto';
import { PhotosService } from './photos.service';

@ApiTags('Fotos del espacio')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@ApiForbiddenResponse({ description: 'El espacio es de otro usuario' })
@ApiNotFoundResponse({ description: 'El espacio no existe' })
@UseGuards(JwtAuthGuard)
@Controller('spaces/:id/photos')
export class PhotosController {
  constructor(private readonly service: PhotosService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  @ApiOperation({
    summary: 'Sube una foto al final de la galería',
    description: 'Campo `file` (multipart). JPG, PNG o WebP de hasta 5 MB; hasta 10 fotos por espacio.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadPhotoDto })
  @ApiCreatedResponse({ type: PhotoDto })
  @ApiBadRequestResponse({ description: 'Falta la foto o su formato no es válido' })
  @ApiPayloadTooLargeResponse({ description: 'La foto pesa más de 5 MB' })
  @ApiConflictResponse({ description: 'El espacio ya tiene 10 fotos' })
  add(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<PhotoDto> {
    return this.service.add(user.id, id, file);
  }

  @Patch('order')
  @ApiOperation({
    summary: 'Ordena las fotos; la primera es la portada',
    description: 'Hay que mandar todas las fotos del espacio, sin repetir.',
  })
  @ApiOkResponse({ type: [PhotoDto] })
  @ApiBadRequestResponse({ description: 'La lista no tiene exactamente las fotos del espacio' })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderPhotosDto,
  ): Promise<PhotoDto[]> {
    return this.service.reorder(user.id, id, dto.photoIds);
  }

  @Delete(':photoId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra una foto' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'El espacio o la foto no existen' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    await this.service.remove(user.id, id, photoId);
  }
}

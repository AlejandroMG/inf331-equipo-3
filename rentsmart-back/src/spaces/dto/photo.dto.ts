import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class PhotoDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Dirección pública de la foto' })
  url: string;

  @ApiProperty({ example: 0, description: 'Orden en la galería; 0 es la portada' })
  position: number;
}

export class ReorderPhotosDto {
  @ApiProperty({
    type: [String],
    description: 'Todos los ids de las fotos del espacio, en el orden nuevo. El primero es la portada',
  })
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @ArrayUnique()
  @IsString({ each: true })
  photoIds: string[];
}

export class UploadPhotoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'JPG, PNG o WebP de hasta 5 MB',
  })
  file: unknown;
}

import { PartialType } from '@nestjs/swagger';
import { CreateSpaceDto } from './create-space.dto';

/** Actualización parcial: lo que no se manda no cambia. */
export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {}

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferenceItemDto } from './dto/reference-item.dto';
import { SpaceTypesService } from './space-types.service';

@ApiTags('Datos de referencia')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly service: SpaceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista el equipamiento disponible' })
  @ApiOkResponse({ type: [ReferenceItemDto] })
  findAll(): Promise<ReferenceItemDto[]> {
    return this.service.findAmenities();
  }
}

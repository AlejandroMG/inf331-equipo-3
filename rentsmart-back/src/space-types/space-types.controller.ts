import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferenceItemDto } from './dto/reference-item.dto';
import { SpaceTypesService } from './space-types.service';

@ApiTags('Datos de referencia')
@Controller('space-types')
export class SpaceTypesController {
  constructor(private readonly service: SpaceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los tipos de espacio' })
  @ApiOkResponse({ type: [ReferenceItemDto] })
  findAll(): Promise<ReferenceItemDto[]> {
    return this.service.findSpaceTypes();
  }
}

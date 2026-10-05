import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReferenceItemDto } from './dto/reference-item.dto';
import { SpaceTypesService } from './space-types.service';

@ApiTags('Datos de referencia')
@Controller('regions')
export class RegionsController {
  constructor(private readonly service: SpaceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las regiones donde se puede publicar' })
  @ApiOkResponse({ type: [ReferenceItemDto] })
  findAll(): Promise<ReferenceItemDto[]> {
    return this.service.findRegions();
  }

  @Get(':id/communes')
  @ApiOperation({ summary: 'Lista las comunas de una región' })
  @ApiOkResponse({ type: [ReferenceItemDto] })
  @ApiNotFoundResponse({ description: 'La región no existe' })
  findCommunes(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReferenceItemDto[]> {
    return this.service.findCommunes(id);
  }
}

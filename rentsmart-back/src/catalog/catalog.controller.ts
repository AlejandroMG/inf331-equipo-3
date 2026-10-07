import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CatalogDetailDto } from './dto/catalog-detail.dto';
import { CatalogPageDto } from './dto/catalog-page.dto';
import { ListCatalogQueryDto } from './dto/list-catalog-query.dto';

@ApiTags('Catálogo')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los espacios activos, paginados y filtrados',
    description:
      'Público: no requiere sesión. Los más recientes primero. Los filtros se combinan (todos deben cumplirse); sin filtros lista todos los activos.',
  })
  @ApiOkResponse({ type: CatalogPageDto })
  @ApiBadRequestResponse({
    description:
      'Un parámetro inválido o desconocido, o un precio mínimo mayor que el máximo',
  })
  findPage(@Query() query: ListCatalogQueryDto): Promise<CatalogPageDto> {
    return this.service.findPage(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle público de un espacio activo',
    description:
      'No incluye el detalle de la dirección (piso, oficina, indicaciones): ese solo lo ve quien tenga una reserva confirmada.',
  })
  @ApiOkResponse({ type: CatalogDetailDto })
  @ApiNotFoundResponse({
    description: 'No existe o no está activo (borrador, inactivo o bloqueado)',
  })
  findOne(@Param('id') id: string): Promise<CatalogDetailDto> {
    return this.service.findOne(id);
  }
}

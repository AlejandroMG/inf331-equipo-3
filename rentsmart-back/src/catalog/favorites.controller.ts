import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CatalogPageDto } from './dto/catalog-page.dto';
import { ListFavoritesQueryDto } from './dto/list-favorites-query.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favoritos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @ApiOperation({
    summary: 'Mis favoritos',
    description:
      'Los espacios guardados que siguen activos, como tarjetas del catálogo, los guardados más recientemente primero.',
  })
  @ApiOkResponse({ type: CatalogPageDto })
  @ApiBadRequestResponse({ description: 'Un parámetro inválido o desconocido' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListFavoritesQueryDto,
  ): Promise<CatalogPageDto> {
    return this.service.list(user.id, query);
  }

  // Va antes que ':spaceId' para que "ids" no se tome por un id de espacio.
  @Get('ids')
  @ApiOperation({
    summary: 'Los ids de mis favoritos',
    description:
      'Solo los ids de los espacios guardados que siguen activos, para marcar el corazón en el catálogo.',
  })
  @ApiOkResponse({ type: [String] })
  ids(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.service.ids(user.id);
  }

  @Put(':spaceId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Guarda un espacio como favorito',
    description: 'Idempotente: guardar uno que ya es favorito no cambia nada.',
  })
  @ApiNoContentResponse({ description: 'Guardado' })
  @ApiNotFoundResponse({ description: 'No existe o no está activo' })
  @ApiConflictResponse({ description: 'Llegó al máximo de favoritos (200)' })
  add(
    @CurrentUser() user: AuthUser,
    @Param('spaceId') spaceId: string,
  ): Promise<void> {
    return this.service.add(user.id, spaceId);
  }

  @Delete(':spaceId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Quita un espacio de mis favoritos',
    description: 'Idempotente: quitar uno que no estaba no es un error.',
  })
  @ApiNoContentResponse({ description: 'Quitado' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('spaceId') spaceId: string,
  ): Promise<void> {
    return this.service.remove(user.id, spaceId);
  }
}

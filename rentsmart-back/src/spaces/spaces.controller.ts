import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { OwnerSpaceSummaryDto } from './dto/owner-space-summary.dto';
import { SpaceDto } from './dto/space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { PublicationService } from './publication.service';
import { SpacesService } from './spaces.service';

@ApiTags('Espacios del propietario')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(
    private readonly service: SpacesService,
    private readonly publication: PublicationService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crea un espacio en borrador',
    description: 'Solo el nombre es obligatorio; el resto se guarda a medida que avanza el formulario.',
  })
  @ApiCreatedResponse({ type: SpaceDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o referencias que no existen' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto): Promise<SpaceDto> {
    return this.service.create(user.id, dto);
  }

  // Va antes que ':id' para que "me" no se tome por un id.
  @Get('me')
  @ApiOperation({
    summary: 'Mis espacios',
    description: 'Los espacios del usuario, de cualquier estado, con lo que le falta a cada uno. Los modificados más recientemente primero.',
  })
  @ApiOkResponse({ type: [OwnerSpaceSummaryDto] })
  findMine(@CurrentUser() user: AuthUser): Promise<OwnerSpaceSummaryDto[]> {
    return this.service.findMine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Un espacio propio, con su detalle privado' })
  @ApiOkResponse({ type: SpaceDto })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SpaceDto> {
    return this.service.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza un espacio propio',
    description: 'Parcial: lo que no se manda no cambia y `null` borra un campo opcional. El estado no se cambia aquí.',
  })
  @ApiOkResponse({ type: SpaceDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o referencias que no existen' })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceDto> {
    return this.service.update(user.id, id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publica un borrador',
    description:
      'Pasa de borrador a activo y habilita a la cuenta como propietaria. Exige tipo, descripción, capacidad, comuna, precio (por hora o por día), al menos una foto y horario semanal. Si falta algo, 409 con `missing`.',
  })
  @ApiOkResponse({ type: SpaceDto })
  @ApiConflictResponse({
    description:
      'Faltan datos (`missing` lista cuáles: type, description, capacity, commune, price, photos, schedule) o el espacio ya no es un borrador',
  })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario o está bloqueado por un administrador' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SpaceDto> {
    return this.publication.publish(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activa o desactiva un espacio publicado',
    description:
      'Desactivarlo lo saca del catálogo y no recibe reservas nuevas; las confirmadas se mantienen. Activarlo exige seguir cumpliendo lo necesario para publicar. Pedir el estado que ya tiene no hace nada.',
  })
  @ApiOkResponse({ type: SpaceDto })
  @ApiBadRequestResponse({ description: 'Solo se acepta ACTIVE o INACTIVE' })
  @ApiConflictResponse({ description: 'Es un borrador, o al activarlo falta algo (`missing`)' })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario o está bloqueado por un administrador' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<SpaceDto> {
    return this.publication.changeStatus(user.id, id, dto.status);
  }
}

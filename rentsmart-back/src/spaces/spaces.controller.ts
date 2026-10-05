import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { DevAuthGuard } from '../common/auth/dev-auth.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceDto } from './dto/space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpacesService } from './spaces.service';

// TEMPORAL: DevAuthGuard se reemplaza por el JwtAuthGuard de A (CU-03) sin cambiar nada más.
@ApiTags('Espacios del propietario')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description: 'Solo desarrollo: id del usuario que actúa. Sin él, el propietario del seed. Se reemplaza por el token JWT.',
})
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@UseGuards(DevAuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(private readonly service: SpacesService) {}

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
}

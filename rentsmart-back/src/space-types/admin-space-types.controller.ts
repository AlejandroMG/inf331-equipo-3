import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../common/auth/admin.guard';
import { DevAuthGuard } from '../common/auth/dev-auth.guard';
import { AdminSpaceTypesService } from './admin-space-types.service';
import {
  AdminSpaceTypeDto,
  SpaceTypeNameDto,
} from './dto/admin-space-type.dto';

// TEMPORAL: DevAuthGuard se reemplaza por el JwtAuthGuard de A (CU-03) y AdminGuard por su RolesGuard.
@ApiTags('Administración de tipos de espacio')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'Solo desarrollo: id del usuario que actúa (debe ser administrador). Sin él, el propietario del seed, que no lo es. Se reemplaza por el token JWT.',
})
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@ApiForbiddenResponse({ description: 'Solo para administradores' })
@UseGuards(DevAuthGuard, AdminGuard)
@Controller('admin/space-types')
export class AdminSpaceTypesController {
  constructor(private readonly service: AdminSpaceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Los tipos de espacio, con cuántos espacios usa cada uno' })
  @ApiOkResponse({ type: [AdminSpaceTypeDto] })
  list(): Promise<AdminSpaceTypeDto[]> {
    return this.service.list();
  }

  @Post()
  @ApiOperation({
    summary: 'Crea un tipo de espacio',
    description: 'Amplía la lista cerrada de tipos (P-08). No se permiten alojamientos.',
  })
  @ApiCreatedResponse({ type: AdminSpaceTypeDto })
  @ApiBadRequestResponse({ description: 'Nombre inválido o de un alojamiento' })
  @ApiConflictResponse({ description: 'Ya existe un tipo con ese nombre' })
  create(@Body() dto: SpaceTypeNameDto): Promise<AdminSpaceTypeDto> {
    return this.service.create(dto.name);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombra un tipo de espacio' })
  @ApiOkResponse({ type: AdminSpaceTypeDto })
  @ApiBadRequestResponse({ description: 'Nombre inválido o de un alojamiento' })
  @ApiNotFoundResponse({ description: 'El tipo no existe' })
  @ApiConflictResponse({ description: 'Ya existe otro tipo con ese nombre' })
  rename(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SpaceTypeNameDto,
  ): Promise<AdminSpaceTypeDto> {
    return this.service.rename(id, dto.name);
  }
}

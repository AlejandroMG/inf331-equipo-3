import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
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
import { AdminSpacesService } from './admin-spaces.service';
import {
  AdminSpaceDto,
  AdminSpacesPageDto,
  BlockSpaceDto,
  ListAdminSpacesQueryDto,
} from './dto/admin-space.dto';

// TEMPORAL: DevAuthGuard se reemplaza por el JwtAuthGuard de A (CU-03) y AdminGuard por su RolesGuard.
@ApiTags('Administración de espacios')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'Solo desarrollo: id del usuario que actúa (debe ser administrador). Sin él, el propietario del seed, que no lo es. Se reemplaza por el token JWT.',
})
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@ApiForbiddenResponse({ description: 'Solo para administradores' })
@UseGuards(DevAuthGuard, AdminGuard)
@Controller('admin/spaces')
export class AdminSpacesController {
  constructor(private readonly service: AdminSpacesService) {}

  @Get()
  @ApiOperation({
    summary: 'Todos los espacios',
    description: 'De cualquier propietario y estado, los modificados más recientemente primero.',
  })
  @ApiOkResponse({ type: AdminSpacesPageDto })
  @ApiBadRequestResponse({ description: 'Un parámetro inválido o desconocido' })
  list(@Query() query: ListAdminSpacesQueryDto): Promise<AdminSpacesPageDto> {
    return this.service.list(query);
  }

  @Post(':id/block')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Despublica (bloquea) un espacio, con un motivo',
    description:
      'Sale del catálogo y su propietario no puede activarlo mientras esté bloqueado; ve el motivo en su panel. Las reservas confirmadas se mantienen.',
  })
  @ApiOkResponse({ type: AdminSpaceDto })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiConflictResponse({ description: 'Es un borrador o ya está bloqueado' })
  block(@Param('id') id: string, @Body() dto: BlockSpaceDto): Promise<AdminSpaceDto> {
    return this.service.block(id, dto.reason);
  }

  @Post(':id/unblock')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desbloquea un espacio',
    description: 'Queda desactivado: su propietario decide cuándo volver a activarlo.',
  })
  @ApiOkResponse({ type: AdminSpaceDto })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiConflictResponse({ description: 'El espacio no está bloqueado' })
  unblock(@Param('id') id: string): Promise<AdminSpaceDto> {
    return this.service.unblock(id);
  }
}

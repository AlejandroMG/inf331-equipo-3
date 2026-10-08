import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { ReplaceScheduleDto, ScheduleDto } from './dto/schedule.dto';

// Cuelga de /spaces/:id, la ruta de los espacios (B), pero es del módulo de disponibilidad (C).
@ApiTags('Disponibilidad')
@Controller('spaces/:id')
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get('availability')
  @ApiOperation({
    summary: 'Bloques libres de un espacio entre dos días',
    description:
      'Público: no requiere sesión. Por cada día pedido (hora de Chile), los bloques de una hora que están dentro del horario semanal, no han pasado y no tienen una reserva pendiente no vencida, pagada o confirmada. `fullDay` trae lo que se manda para reservar el día completo.',
  })
  @ApiOkResponse({ type: AvailabilityDto })
  @ApiBadRequestResponse({
    description: 'Falta una fecha, no es AAAA-MM-DD, no existe, from es posterior a to o se piden más de 31 días',
  })
  @ApiNotFoundResponse({ description: 'El espacio no existe o no está activo' })
  findAvailability(@Param('id') id: string, @Query() query: AvailabilityQueryDto): Promise<AvailabilityDto> {
    return this.service.findAvailability(id, query);
  }

  @Get('schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Horario semanal de un espacio propio',
    description:
      'Para el formulario del propietario, también en un borrador. El horario de un espacio publicado es público en `GET /api/catalog/:id`.',
  })
  @ApiOkResponse({ type: ScheduleDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  findSchedule(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ScheduleDto> {
    return this.service.findSchedule(user.id, id);
  }

  @Put('schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reemplaza el horario semanal de un espacio propio',
    description:
      'En hora de Chile y en horas cerradas. Reemplaza el horario completo y no cambia las reservas que ya existen.',
  })
  @ApiOkResponse({ type: ScheduleDto })
  @ApiBadRequestResponse({
    description: 'Un día u hora inválidos, un fin que no es posterior al inicio o rangos del mismo día que se traslapan',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  @ApiForbiddenResponse({ description: 'El espacio es de otro usuario' })
  @ApiNotFoundResponse({ description: 'El espacio no existe' })
  @ApiConflictResponse({
    description: 'Dejaría sin horario a un espacio publicado (`missing: ["schedule"]`): hay que desactivarlo primero',
  })
  replaceSchedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplaceScheduleDto,
  ): Promise<ScheduleDto> {
    return this.service.replaceSchedule(user.id, id, dto);
  }
}

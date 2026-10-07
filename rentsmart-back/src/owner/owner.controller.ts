import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { DevAuthGuard } from '../common/auth/dev-auth.guard';
import { ListOwnerBookingsQueryDto } from './dto/list-owner-bookings-query.dto';
import { OwnerBookingsPageDto } from './dto/owner-booking.dto';
import { OwnerMetricsDto, OwnerMetricsQueryDto } from './dto/owner-metrics.dto';
import { OwnerBookingsService } from './owner-bookings.service';
import { OwnerMetricsService } from './owner-metrics.service';

// TEMPORAL: DevAuthGuard se reemplaza por el JwtAuthGuard de A (CU-03) sin cambiar nada más.
@ApiTags('Panel del propietario')
@ApiHeader({
  name: 'x-user-id',
  required: false,
  description:
    'Solo desarrollo: id del usuario que actúa. Sin él, el propietario del seed. Se reemplaza por el token JWT.',
})
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@UseGuards(DevAuthGuard)
@Controller('owner')
export class OwnerController {
  constructor(
    private readonly bookings: OwnerBookingsService,
    private readonly metrics: OwnerMetricsService,
  ) {}

  @Get('bookings')
  @ApiOperation({
    summary: 'Reservas de mis espacios',
    description:
      'Las reservas de todos mis espacios, filtrables por estado y por fecha de inicio (hora de Chile). El contacto del arrendatario solo viene en las confirmadas.',
  })
  @ApiOkResponse({ type: OwnerBookingsPageDto })
  @ApiBadRequestResponse({
    description: 'Un parámetro inválido o desconocido, o una fecha inicial posterior a la final',
  })
  bookingsList(
    @CurrentUser() user: AuthUser,
    @Query() query: ListOwnerBookingsQueryDto,
  ): Promise<OwnerBookingsPageDto> {
    return this.bookings.list(user.id, query);
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Métricas de mis espacios en un mes',
    description:
      'Ingresos del mes y ocupación de cada espacio: las horas reservadas sobre las horas arrendables de su horario semanal. Cuentan las reservas confirmadas y las finalizadas que empiezan en el mes (hora de Chile).',
  })
  @ApiOkResponse({ type: OwnerMetricsDto })
  @ApiBadRequestResponse({ description: 'Un mes inválido (AAAA-MM)' })
  metricsOf(
    @CurrentUser() user: AuthUser,
    @Query() query: OwnerMetricsQueryDto,
  ): Promise<OwnerMetricsDto> {
    return this.metrics.metrics(user.id, query.month);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { BookingsService } from './bookings.service';
import { BookingCheckoutDto, BookingDto, BookingsPageDto } from './dto/booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PageQueryDto } from './dto/page-query.dto';

@ApiTags('Reservas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sin sesión' })
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Reserva un horario y entrega el enlace de pago',
    description:
      'Crea la reserva en `PENDING`, que retiene el horario 30 minutos, y una sesión de Stripe Checkout por el total. El front redirige a `checkoutUrl`.',
  })
  @ApiCreatedResponse({ type: BookingCheckoutDto })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: fechas que no son horas cerradas en UTC, un fin que no es posterior al inicio, un horario que ya pasó, o un espacio que no se arrienda en esa unidad',
  })
  @ApiNotFoundResponse({ description: 'El espacio no existe o no está activo' })
  @ApiConflictResponse({
    description: 'El horario está fuera del horario semanal o ya tiene una reserva pendiente, pagada o confirmada',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto): Promise<BookingCheckoutDto> {
    return this.service.create(user.id, dto);
  }

  // Va antes que ':id' para que "me" no se tome por un id.
  @Get('me')
  @ApiOperation({
    summary: 'Mis reservas',
    description: 'Las reservas que hice como arrendatario, de cualquier estado, las creadas más recientemente primero.',
  })
  @ApiOkResponse({ type: BookingsPageDto })
  @ApiBadRequestResponse({ description: 'Un parámetro inválido o desconocido' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<BookingsPageDto> {
    return this.service.findMine(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Una reserva mía',
    description:
      'Con su estado y el desglose (subtotal, comisión y total). Después de pagar, el front la consulta hasta verla `CONFIRMED`; recién entonces trae el detalle privado de la dirección.',
  })
  @ApiOkResponse({ type: BookingDto })
  @ApiForbiddenResponse({ description: 'La reserva es de otro usuario' })
  @ApiNotFoundResponse({ description: 'La reserva no existe' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<BookingDto> {
    return this.service.findOne(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancela una reserva mía',
    description:
      'Fuera del MVP del 9 de octubre (RE-05): la política de cancelación y reembolso sigue abierta (P-14). Queda en el contrato para no cambiar la forma después.',
  })
  @ApiOkResponse({ type: BookingDto })
  @ApiForbiddenResponse({ description: 'La reserva es de otro usuario' })
  @ApiNotFoundResponse({ description: 'La reserva no existe' })
  @ApiConflictResponse({ description: 'La reserva ya no se puede cancelar (finalizada, cancelada o expirada)' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<BookingDto> {
    return this.service.cancel(user.id, id);
  }
}

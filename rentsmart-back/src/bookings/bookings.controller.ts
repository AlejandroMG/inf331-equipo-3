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
import { CancelBookingDto } from './dto/cancel-booking.dto';
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
    summary: 'Cancela una reserva',
    description:
      'La cancela su arrendatario o el dueño del espacio, desde `PENDING` o `CONFIRMED`, con un motivo que queda en el historial. Política (P-14): si cancela el propietario se reembolsa el total; si cancela el arrendatario, el total hasta 24 horas antes del inicio y nada después. El reembolso en Stripe llega con PA-03.',
  })
  @ApiOkResponse({ type: BookingDto })
  @ApiBadRequestResponse({ description: 'Falta el motivo o no tiene entre 5 y 500 caracteres' })
  @ApiForbiddenResponse({ description: 'La reserva no es tuya ni de un espacio tuyo' })
  @ApiNotFoundResponse({ description: 'La reserva no existe' })
  @ApiConflictResponse({
    description:
      'La reserva no se puede cancelar: está pagada sin confirmar, finalizada, cancelada, expirada o venció su plazo de pago',
  })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingDto> {
    return this.service.cancel(user.id, id, dto);
  }
}

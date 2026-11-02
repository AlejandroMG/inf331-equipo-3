import { BadRequestException, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PageQueryDto } from '../bookings/dto/page-query.dto';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { PaymentsPageDto, WebhookAckDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // Sin sesión: lo llama Stripe, y lo que lo autentica es la firma del cuerpo.
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de Stripe',
    description:
      'Solo lo llama Stripe. Recibe el evento con el cuerpo sin interpretar y verifica su firma. `checkout.session.completed` pasa la reserva `PENDING` a `PAID` y la valida: queda `CONFIRMED` o, si no pasa la validación, `CANCELLED` con reembolso del total; si la reserva ya está `EXPIRED` o `CANCELLED`, no cambia y se reembolsa el total. `checkout.session.expired` pasa la reserva `PENDING` a `EXPIRED`. Es idempotente: un evento repetido o de un tipo que no interesa responde 200 sin cambiar nada; sobre una reserva `PAID`, además vuelve a pedir la confirmación. Un 409 o un 500 hacen que Stripe reintente, un número limitado de veces.',
  })
  @ApiHeader({ name: 'stripe-signature', required: true, description: 'Firma del evento, la pone Stripe' })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiBadRequestResponse({ description: 'Falta la firma o no corresponde al cuerpo' })
  @ApiConflictResponse({ description: 'La reserva cambió de estado mientras se procesaba el pago; Stripe reintenta' })
  @ApiInternalServerErrorResponse({ description: 'Falló un reembolso o la base de datos; Stripe reintenta' })
  @ApiServiceUnavailableResponse({ description: 'Stripe no está configurado en esta API' })
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<WebhookAckDto> {
    if (!signature) throw new BadRequestException('Falta la firma de Stripe');
    return this.service.handleWebhook(request.rawBody, signature);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mis pagos',
    description:
      'Los pagos de mis reservas como arrendatario, los más recientes primero. Un pago nace `PENDING` al reservar con Stripe Checkout; las reservas hechas sin Stripe (sin `STRIPE_SECRET_KEY`) no tienen pago.',
  })
  @ApiOkResponse({ type: PaymentsPageDto })
  @ApiBadRequestResponse({ description: 'Un parámetro inválido o desconocido' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<PaymentsPageDto> {
    return this.service.findMine(user.id, query);
  }
}

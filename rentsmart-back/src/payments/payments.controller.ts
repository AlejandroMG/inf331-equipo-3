import { BadRequestException, Controller, Get, Headers, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
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
      'Solo lo llama Stripe. Recibe el evento con el cuerpo sin interpretar y verifica su firma. `checkout.session.completed` pasa la reserva a `PAID` y dispara la confirmación; `checkout.session.expired` la pasa a `EXPIRED`. Es idempotente: un evento repetido o de un tipo que no interesa responde 200 sin hacer nada.',
  })
  @ApiHeader({ name: 'stripe-signature', required: true, description: 'Firma del evento, la pone Stripe' })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiBadRequestResponse({ description: 'Falta la firma o no corresponde al cuerpo' })
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
    description: 'Los pagos de mis reservas como arrendatario, los más recientes primero.',
  })
  @ApiOkResponse({ type: PaymentsPageDto })
  @ApiBadRequestResponse({ description: 'Un parámetro inválido o desconocido' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<PaymentsPageDto> {
    return this.service.findMine(user.id, query);
  }
}

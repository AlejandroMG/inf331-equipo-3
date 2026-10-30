import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MAX_RANGE_MS } from '../availability/availability-slots';
import { AvailabilityService } from '../availability/availability.service';
import { BookingStatus, BookingUnit, PaymentStatus, SpaceStatus } from '../generated/prisma/enums';
import { CHECKOUT_GATEWAY, type CheckoutGateway } from '../payments/checkout-gateway';
import { PrismaService } from '../prisma/prisma.service';
import { BookingExpiryService } from './booking-expiry.service';
import { BookingStateService } from './booking-state.service';
import { BOOKING_VIEW, toBookingDto } from './booking-view';
import { cancellationRefund, CancelledBy } from './cancellation-policy';
import { BookingCheckoutDto, BookingDto, BookingsPageDto } from './dto/booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PageQueryDto } from './dto/page-query.dto';
import { bookingAmounts, priceFor } from './pricing';

/**
 * Cuánto retiene el horario una reserva `PENDING` mientras se paga (P-06, enmienda del 29-10-2026). La sesión de
 * Stripe Checkout vence en el mismo instante; Stripe exige al menos 30 minutos desde que se crea la sesión, y el
 * minuto de más deja un margen de unos 40 s o más después de lo que tarda la transacción en llegar a crearla.
 */
export const HOLD_MINUTES = 31;

/**
 * Tiempo máximo de la transacción de `create`. El de Prisma por defecto (5 s) queda justo si el checkout de PA-01
 * llama a Stripe dentro de ella.
 */
const CREATE_TX_TIMEOUT_MS = 15_000;

/** El mayor `Int` de Postgres: `subtotal`, `fee` y `total` son columnas `Int` y un monto mayor no se puede guardar. */
export const MAX_DB_INT = 2_147_483_647;

/**
 * El mayor monto que acepta Stripe en un pago: 8 dígitos en la unidad mínima de la moneda. CLP no tiene decimales,
 * así que son 99 999 999 CLP. Es el límite general de la documentación de Stripe (docs.stripe.com/currencies); para
 * tarjetas el límite es mayor (12 dígitos, 9 con American Express), pero Checkout puede ofrecer otros medios, así que
 * se usa el de 8 como tope conservador (PA-01, #45).
 */
export const MAX_STRIPE_AMOUNT = 99_999_999;

/** El total máximo de una reserva: el menor de los dos topes. Hoy es el de Stripe, que también cubre el de la base. */
export const MAX_BOOKING_TOTAL = Math.min(MAX_DB_INT, MAX_STRIPE_AMOUNT);

/** Desde qué estados cancela una persona (RE-05). `PAID` dura un instante y lo resuelve la validación automática. */
const CANCELLABLE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

/** Reservas del arrendatario: reservar y consultar (RE-02) y cancelar (RE-05). */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: BookingStateService,
    private readonly availability: AvailabilityService,
    private readonly expiry: BookingExpiryService,
    @Inject(CHECKOUT_GATEWAY) private readonly checkout: CheckoutGateway,
  ) {}

  /**
   * Reserva un horario (RE-02): crea la reserva `PENDING`, que retiene el horario 31 minutos (P-06), y pide al
   * puerto de checkout a dónde ir a pagar; con Stripe, además registra el `Payment` pendiente (PA-01). Todo pasa en
   * una sola transacción, así que si algo falla no queda nada.
   *
   * - 400 si el fin no es posterior al inicio, si el rango supera 31 días (el tope de la disponibilidad), si el
   *   inicio ya pasó (un bloque ya pasó desde que empieza, como en DI-02), si el espacio no tiene precio en esa
   *   unidad o si el total supera lo que acepta Stripe (`MAX_BOOKING_TOTAL`); 404 si el espacio no existe o no está
   *   `ACTIVE`; 403 si quien reserva es el dueño del espacio; 409 si el horario está fuera del horario semanal o ya
   *   está ocupado.
   * - Antes de revisar la disponibilidad pasa a `EXPIRED` las `PENDING` vencidas del espacio: dejan de bloquear el
   *   horario y no chocan con `booking_no_overlap` al insertar.
   * - Los montos los calcula el servidor (`bookingAmounts`); el cliente nunca los manda.
   * - `now` es la hora actual; se recibe para poder probar con un reloj fijo.
   *
   * **Concurrencia (RE-03, #40):** la revisión de `isAvailable` corre en la transacción, pero con el aislamiento
   * por defecto (read committed) dos solicitudes simultáneas por el mismo horario pueden pasarla las dos. La
   * restricción `booking_no_overlap` impide que se inserten ambas, pero hoy la segunda recibe el error de la base
   * (un 500), no un 409. Traducir ese error a 409 y probar dos solicitudes simultáneas queda para RE-03.
   */
  async create(userId: string, dto: CreateBookingDto, now: Date = new Date()): Promise<BookingCheckoutDto> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) throw new BadRequestException('El fin de la reserva debe ser posterior al inicio');
    if (endAt.getTime() - startAt.getTime() > MAX_RANGE_MS) {
      throw new BadRequestException('Una reserva no puede durar más de 31 días');
    }
    if (startAt <= now) throw new BadRequestException('Ese horario ya empezó o ya pasó; elige uno futuro');

    // PA-01: si el checkout ya creó una sesión de pago y después falla el resto de la transacción, se anula.
    let createdSessionId: string | undefined;
    return this.prisma.$transaction(
      async (tx) => {
        const space = await tx.space.findUnique({
          where: { id: dto.spaceId },
          select: { id: true, name: true, ownerId: true, status: true, pricePerHour: true, pricePerDay: true },
        });
        if (!space || space.status !== SpaceStatus.ACTIVE) {
          throw new NotFoundException('El espacio no existe o no está disponible para reservar');
        }
        if (space.ownerId === userId) throw new ForbiddenException('No puedes reservar un espacio tuyo');
        if (priceFor(space, dto.unit) === null) {
          throw new BadRequestException(
            `Este espacio no se arrienda por ${dto.unit === BookingUnit.DAY ? 'día' : 'hora'}`,
          );
        }

        const amounts = bookingAmounts(space, dto.unit, startAt, endAt);
        // PA-01 (#45): el tope de Stripe (99 999 999 CLP) es menor que el `Int` de la base, así que cubre los dos.
        // Va antes de revisar el horario: un total fuera de rango es un 400 aunque el horario esté ocupado.
        if (amounts.total > MAX_BOOKING_TOTAL) {
          throw new BadRequestException(
            `El total de la reserva supera el máximo que se puede pagar en línea (${MAX_BOOKING_TOTAL} CLP); elige menos horas`,
          );
        }

        await this.expiry.expireStalePending(tx, now, space.id);
        const free = await this.availability.isAvailable(space.id, startAt, endAt, { tx, now, unit: dto.unit });
        if (!free) {
          throw new ConflictException(
            'Ese horario no está disponible: está fuera del horario del espacio o alguien ya lo reservó',
          );
        }

        const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);
        const booking = await tx.booking.create({
          data: { spaceId: space.id, renterId: userId, startAt, endAt, unit: dto.unit, ...amounts, expiresAt },
          select: { id: true },
        });
        await this.state.recordCreation(booking.id, { actorId: userId }, tx);

        // Con Stripe (PA-01), esta llamada crea la Checkout Session. Va dentro de la transacción para que,
        // si falla, no quede una reserva reteniendo el horario sin forma de pagarla.
        const session = await this.checkout.createSession({ id: booking.id, spaceName: space.name, ...amounts, expiresAt });
        createdSessionId = session.sessionId;
        if (session.sessionId) {
          await tx.booking.update({ where: { id: booking.id }, data: { stripeCheckoutSessionId: session.sessionId } });
          // PA-01: registra el pago pendiente con el monto, la comisión y el id de la sesión. El PaymentIntent y el
          // cambio de estado los completa el webhook (PA-02). Sin `sessionId` (checkout provisorio, sin Stripe) no
          // hay pago que registrar.
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              stripeSessionId: session.sessionId,
              amount: amounts.total,
              fee: amounts.fee,
              status: PaymentStatus.PENDING,
            },
          });
        }
        return { bookingId: booking.id, checkoutUrl: session.url };
      },
      { timeout: CREATE_TX_TIMEOUT_MS },
    ).catch((error: unknown) => {
      if (createdSessionId) this.releaseOrphanSession(createdSessionId);
      throw error;
    });
  }

  /**
   * Anula, sin esperar, una sesión de pago que quedó sin reserva porque la transacción de `create` falló después de
   * crearla (un error al guardar, el COMMIT o el tiempo máximo). Si no se puede, queda en el log y la sesión vence
   * sola en `expiresAt`; el webhook de PA-02 tolera una sesión sin reserva.
   */
  private releaseOrphanSession(sessionId: string): void {
    if (!this.checkout.cancelSession) return;
    void this.checkout.cancelSession(sessionId).then(
      () => this.logger.log(`Sesión de pago ${sessionId} anulada: la reserva no se pudo guardar`),
      (error: unknown) =>
        this.logger.warn(
          `No se pudo anular la sesión de pago ${sessionId}, que quedó sin reserva: ${error instanceof Error ? error.name : 'error'}`,
        ),
    );
  }

  /** Mis reservas como arrendatario, de cualquier estado, las creadas más recientemente primero. */
  async findMine(userId: string, { page, pageSize }: PageQueryDto): Promise<BookingsPageDto> {
    const where = { renterId: userId };
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_VIEW,
        // El id desempata dos reservas creadas en el mismo milisegundo, así las páginas no se cruzan.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: bookings.map(toBookingDto), total, page, pageSize };
  }

  /** Una reserva mía. 404 si no existe y 403 si es de otro arrendatario. */
  async findOne(userId: string, id: string): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_VIEW });
    if (!booking) throw new NotFoundException('La reserva no existe');
    if (booking.renterId !== userId) throw new ForbiddenException('Esta reserva no es tuya');
    return toBookingDto(booking);
  }

  /**
   * Cancela una reserva `PENDING` o `CONFIRMED`. Puede hacerlo su arrendatario o el dueño del espacio, con un
   * motivo que queda en el historial. El monto a reembolsar lo decide `cancellationRefund` (P-14).
   */
  async cancel(userId: string, id: string, dto: CancelBookingDto): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_VIEW });
    if (!booking) throw new NotFoundException('La reserva no existe');
    const cancelledBy = roleOf(userId, booking.renterId, booking.space.ownerId);
    if (!cancelledBy) throw new ForbiddenException('Esta reserva no es tuya ni de un espacio tuyo');

    const now = new Date();
    if (booking.status === BookingStatus.PENDING && booking.expiresAt && booking.expiresAt <= now) {
      // Ya venció el plazo de pago: se deja como vencida, en su propia transacción, y no hay nada que cancelar.
      await this.state.transition(id, BookingStatus.EXPIRED, { actorId: null, reason: 'Venció el plazo de pago' });
      throw new ConflictException('La reserva venció sin pagarse; ya no se puede cancelar');
    }
    if (!CANCELLABLE.includes(booking.status)) {
      throw new ConflictException(`Una reserva en estado ${booking.status} no se puede cancelar`);
    }
    if (booking.status === BookingStatus.CONFIRMED && booking.endAt <= now) {
      // Ya se usó; el barrido de RE-06 la pasará a FINISHED. Cancelarla reembolsaría una reserva usada (P-14).
      throw new ConflictException('La reserva ya terminó; no se puede cancelar');
    }

    const refund = cancellationRefund(booking, cancelledBy, now);
    await this.prisma.$transaction(async (tx) => {
      // Bloquea la fila en el estado que se revisó: si en el intertanto llegó el pago u otro cambio, no cancela.
      const locked = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: { status: booking.status },
      });
      if (locked.count === 0) {
        throw new ConflictException('La reserva cambió de estado mientras se procesaba; vuelve a intentarlo');
      }
      await this.state.transition(id, BookingStatus.CANCELLED, { actorId: userId, reason: dto.reason }, tx);
    });

    // PA-03 (#47): aquí va el reembolso en Stripe por `refund` CLP, que además debe actualizar
    // `Payment.refundedAmount` y `Payment.status`. Todavía no existe; por ahora solo queda en el registro.
    if (refund > 0) {
      this.logger.warn(`Reserva ${id} cancelada: reembolso de ${refund} CLP pendiente (PA-03)`);
    }

    return toBookingDto({ ...booking, status: BookingStatus.CANCELLED });
  }
}

function roleOf(userId: string, renterId: string, ownerId: string): CancelledBy | null {
  if (userId === renterId) return 'RENTER';
  if (userId === ownerId) return 'OWNER';
  return null;
}

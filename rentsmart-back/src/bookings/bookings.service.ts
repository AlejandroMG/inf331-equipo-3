import { Injectable, NotImplementedException } from '@nestjs/common';
import { BookingCheckoutDto, BookingDto, BookingsPageDto } from './dto/booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PageQueryDto } from './dto/page-query.dto';

/**
 * Contrato de F-05: los métodos quedan definidos y responden 501 hasta que exista su historia
 * (RE-02 reservar, PA-01 el pago, RE-05 cancelar).
 */
@Injectable()
export class BookingsService {
  create(_userId: string, _dto: CreateBookingDto): Promise<BookingCheckoutDto> {
    throw new NotImplementedException('Reservar todavía no está implementado (RE-02)');
  }

  findMine(_userId: string, _query: PageQueryDto): Promise<BookingsPageDto> {
    throw new NotImplementedException('Mis reservas todavía no está implementado (RE-02)');
  }

  findOne(_userId: string, _id: string): Promise<BookingDto> {
    throw new NotImplementedException('Ver una reserva todavía no está implementado (RE-02)');
  }

  cancel(_userId: string, _id: string): Promise<BookingDto> {
    throw new NotImplementedException('Cancelar una reserva queda para después del 9 de octubre (RE-05)');
  }
}

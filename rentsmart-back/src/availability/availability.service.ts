import { Injectable, NotImplementedException } from '@nestjs/common';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { ReplaceScheduleDto, ScheduleDto } from './dto/schedule.dto';

/**
 * Contrato de F-05: los métodos quedan definidos y responden 501 hasta que exista su historia
 * (DI-01 el horario semanal, DI-02 la disponibilidad).
 */
@Injectable()
export class AvailabilityService {
  findAvailability(_spaceId: string, _query: AvailabilityQueryDto): Promise<AvailabilityDto> {
    throw new NotImplementedException('La disponibilidad todavía no está implementada (DI-02)');
  }

  findSchedule(_userId: string, _spaceId: string): Promise<ScheduleDto> {
    throw new NotImplementedException('El horario semanal todavía no está implementado (DI-01)');
  }

  replaceSchedule(_userId: string, _spaceId: string, _dto: ReplaceScheduleDto): Promise<ScheduleDto> {
    throw new NotImplementedException('El horario semanal todavía no está implementado (DI-01)');
  }
}

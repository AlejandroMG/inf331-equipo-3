import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SpaceStatus } from '../../generated/prisma/enums';

/** Estados que el propietario puede pedir. DRAFT y BLOCKED no: el primero es de un borrador y el segundo lo pone un admin. */
export const OWNER_STATUSES = [SpaceStatus.ACTIVE, SpaceStatus.INACTIVE];

export class ChangeStatusDto {
  @ApiProperty({
    enum: OWNER_STATUSES,
    description:
      '`INACTIVE` saca el espacio del catálogo y no recibe reservas nuevas (las confirmadas se mantienen). `ACTIVE` lo vuelve a publicar, si cumple lo necesario',
  })
  @IsIn(OWNER_STATUSES)
  status: SpaceStatus;
}

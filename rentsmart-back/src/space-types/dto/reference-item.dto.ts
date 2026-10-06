import { ApiProperty } from '@nestjs/swagger';

/** Elemento de una lista de referencia: tipo de espacio, equipamiento, región o comuna. */
export class ReferenceItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Sala de reuniones' })
  name: string;
}

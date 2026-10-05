/** Elemento de una lista de referencia (tipo de espacio, equipamiento, región o comuna). */
export interface ReferenceItem {
  id: number
  name: string
}

/** Espacio propio tal como lo devuelve el back al propietario (GET /api/spaces/:id). */
export interface OwnerSpace {
  id: string
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  name: string
  typeId: number | null
  description: string | null
  capacity: number | null
  pricePerHour: number | null
  pricePerDay: number | null
  regionId: number | null
  communeId: number | null
  address: string | null
  /** Detalle privado: solo lo ve el dueño y quien tenga una reserva confirmada. */
  addressDetail: string | null
  rules: string | null
  amenityIds: number[]
  createdAt: string
  updatedAt: string
}

/** Cuerpo de POST y PATCH /api/spaces: `null` borra un campo opcional. */
export interface SpacePayload {
  name: string
  typeId: number | null
  description: string | null
  capacity: number | null
  pricePerHour: number | null
  pricePerDay: number | null
  regionId: number | null
  communeId: number | null
  address: string | null
  addressDetail: string | null
  rules: string | null
  amenityIds: number[]
}

/** Datos del formulario: los campos de texto y número se guardan como texto, como los escribe la persona. */
export interface SpaceForm {
  name: string
  typeId: string
  description: string
  capacity: string
  amenityIds: number[]
  rules: string
  communeId: string
  address: string
  addressDetail: string
  pricePerHour: string
  pricePerDay: string
}

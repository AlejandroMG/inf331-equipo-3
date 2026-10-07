import type { OwnerSpace } from '../spaces/types'

/** Un espacio en la lista del administrador (GET /api/admin/spaces): de cualquier propietario y estado. */
export interface AdminSpace {
  id: string
  name: string
  status: OwnerSpace['status']
  ownerName: string
  ownerEmail: string
  typeName: string | null
  communeName: string | null
  /** Por qué se bloqueó; solo si está bloqueado. */
  blockedReason: string | null
  blockedAt: string | null
  updatedAt: string
}

export interface AdminSpacesPage {
  items: AdminSpace[]
  total: number
  page: number
  pageSize: number
}

/** Un tipo de espacio con cuántos espacios lo usan (GET /api/admin/space-types). */
export interface AdminSpaceType {
  id: number
  name: string
  spaces: number
}

export const MIN_REASON = 5
export const MAX_REASON = 500
export const MIN_TYPE_NAME = 2
export const MAX_TYPE_NAME = 60

import { http } from '../../lib/http'
import type { OwnerSpace } from '../spaces/types'
import type { AdminSpace, AdminSpacesPage, AdminSpaceType } from './types'

export const ADMIN_PAGE_SIZE = 20

export interface AdminSpaceFilters {
  status: OwnerSpace['status'] | null
  q: string
}

/** Una página de todos los espacios. El cliente HTTP omite los filtros vacíos. */
export function fetchAdminSpaces({ page, filters, signal }: { page: number; filters: AdminSpaceFilters; signal?: AbortSignal }) {
  return http.get<AdminSpacesPage>('/admin/spaces', {
    params: { page, pageSize: ADMIN_PAGE_SIZE, status: filters.status, q: filters.q },
    signal,
  })
}

/** Despublica un espacio con un motivo que verá su propietario. */
export const blockSpace = (id: string, reason: string) => http.post<AdminSpace>(`/admin/spaces/${encodeURIComponent(id)}/block`, { reason })

/** Lo desbloquea: queda desactivado y el propietario decide cuándo activarlo. */
export const unblockSpace = (id: string) => http.post<AdminSpace>(`/admin/spaces/${encodeURIComponent(id)}/unblock`)

export const fetchAdminSpaceTypes = (signal?: AbortSignal) => http.get<AdminSpaceType[]>('/admin/space-types', { signal })

export const createSpaceType = (name: string) => http.post<AdminSpaceType>('/admin/space-types', { name })

export const renameSpaceType = (id: number, name: string) => http.patch<AdminSpaceType>(`/admin/space-types/${id}`, { name })

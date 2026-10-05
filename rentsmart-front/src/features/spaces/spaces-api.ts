import { http } from '../../lib/http'
import type { OwnerSpace, ReferenceItem, SpacePayload } from './types'

export const fetchSpaceTypes = (signal?: AbortSignal) => http.get<ReferenceItem[]>('/space-types', { signal })

export const fetchAmenities = (signal?: AbortSignal) => http.get<ReferenceItem[]>('/amenities', { signal })

export const fetchRegions = (signal?: AbortSignal) => http.get<ReferenceItem[]>('/regions', { signal })

export const fetchCommunes = (regionId: number, signal?: AbortSignal) =>
  http.get<ReferenceItem[]>(`/regions/${regionId}/communes`, { signal })

export const fetchOwnSpace = (id: string, signal?: AbortSignal) =>
  http.get<OwnerSpace>(`/spaces/${encodeURIComponent(id)}`, { signal })

export const createSpace = (payload: SpacePayload) => http.post<OwnerSpace>('/spaces', payload)

export const updateSpace = (id: string, payload: SpacePayload) =>
  http.patch<OwnerSpace>(`/spaces/${encodeURIComponent(id)}`, payload)

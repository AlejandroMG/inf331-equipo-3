import { http } from '../../lib/http'
import type { OwnerPhoto, OwnerSpace, ReferenceItem, SpacePayload } from './types'

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

/** Sube una foto (multipart, campo `file`) al final de la galería. */
export function uploadPhoto(spaceId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return http.post<OwnerPhoto>(`/spaces/${encodeURIComponent(spaceId)}/photos`, body)
}

/** Ordena las fotos: `photoIds` debe traer todas las del espacio; la primera es la portada. */
export const reorderPhotos = (spaceId: string, photoIds: string[]) =>
  http.patch<OwnerPhoto[]>(`/spaces/${encodeURIComponent(spaceId)}/photos/order`, { photoIds })

export const deletePhoto = (spaceId: string, photoId: string) =>
  http.delete<void>(`/spaces/${encodeURIComponent(spaceId)}/photos/${encodeURIComponent(photoId)}`)

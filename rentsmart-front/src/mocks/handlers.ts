import { http, HttpResponse } from 'msw'
import type { SpaceDetail } from '../features/catalog/types'
import type { OwnerPhoto, OwnerSpace, SpacePayload } from '../features/spaces/types'
import { catalogData } from './catalog-data'

/** Detalle de ejemplo a partir de un espacio de la lista: horario de lunes a viernes y datos genéricos. */
function detailOf(item: (typeof catalogData)[number]): SpaceDetail {
  return {
    ...item,
    description: 'Espacio de ejemplo para el catálogo simulado.',
    regionName: 'Región Metropolitana',
    address: 'Av. Libertador Bernardo O’Higgins 1234',
    rules: 'No fumar.',
    amenities: ['Aire acondicionado', 'Proyector', 'Wifi'],
    photos: item.coverUrl ? [{ id: `${item.id}-0`, url: item.coverUrl, position: 0 }] : [],
    schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '21:00' })),
  }
}

/** Borradores creados con el POST simulado; permiten volver a abrirlos con GET y PATCH. */
const drafts = new Map<string, OwnerSpace>()

/** Vacía los borradores simulados (los tests lo llaman entre pruebas). */
export function resetMockDrafts() {
  drafts.clear()
  photoCounter = 0
}

function ownerSpace(id: string, payload: SpacePayload, previous?: OwnerSpace): OwnerSpace {
  const now = new Date().toISOString()
  return { ...payload, id, status: previous?.status ?? 'DRAFT', photos: previous?.photos ?? [], createdAt: previous?.createdAt ?? now, updatedAt: now }
}

let photoCounter = 0

/** Foto simulada: un cuadro de color en una dirección de datos, para no depender de archivos ni de la red. */
function mockPhoto(position: number): OwnerPhoto {
  photoCounter += 1
  const hue = (photoCounter * 47) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="hsl(${hue} 45% 80%)"/><text x="300" y="215" font-size="40" text-anchor="middle" fill="hsl(${hue} 45% 25%)" font-family="sans-serif">Foto ${photoCounter}</text></svg>`
  return { id: `photo-${photoCounter}`, url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, position }
}

/**
 * Lo que falta para publicar (P-18), con los mismos códigos que el back. El horario semanal (DI-01) se da por
 * cargado: así el flujo se puede recorrer completo sin el equipo de reservas.
 */
function missingToPublish(space: OwnerSpace): string[] {
  const missing: string[] = []
  if (space.typeId === null) missing.push('type')
  if (!space.description?.trim()) missing.push('description')
  if (!space.capacity) missing.push('capacity')
  if (space.communeId === null) missing.push('commune')
  if (!space.pricePerHour && !space.pricePerDay) missing.push('price')
  if (space.photos.length === 0) missing.push('photos')
  return missing
}

const conflict = (message: string, extra: object = {}) =>
  HttpResponse.json({ statusCode: 409, error: 'Conflict', message, ...extra }, { status: 409 })

const notFound = (message: string) =>
  HttpResponse.json({ message, error: 'Not Found', statusCode: 404 }, { status: 404 })

/**
 * Respuestas simuladas de la API mientras el endpoint real no exista.
 * Cada dominio agrega aquí los handlers de sus endpoints, con la forma que quedó en el contrato (F-05).
 */
export const handlers = [
  // ES-01: tipos de espacio (los 8 del seed).
  http.get('*/api/space-types', () =>
    HttpResponse.json([
      { id: 1, name: 'Sala de reuniones' },
      { id: 2, name: 'Oficina o cowork' },
      { id: 3, name: 'Estudio fotográfico o audiovisual' },
      { id: 4, name: 'Sala de ensayo' },
      { id: 5, name: 'Cocina equipada' },
      { id: 6, name: 'Cancha' },
      { id: 7, name: 'Salón de eventos' },
      { id: 8, name: 'Taller' },
    ]),
  ),

  // ES-01: equipamiento, regiones y comunas (las del seed).
  http.get('*/api/amenities', () =>
    HttpResponse.json([
      { id: 4, name: 'Aire acondicionado' },
      { id: 5, name: 'Cocina' },
      { id: 3, name: 'Estacionamiento' },
      { id: 2, name: 'Proyector' },
      { id: 1, name: 'Wifi' },
    ]),
  ),
  http.get('*/api/regions', () => HttpResponse.json([{ id: 1, name: 'Región Metropolitana' }])),
  http.get('*/api/regions/:id/communes', () =>
    HttpResponse.json([
      { id: 4, name: 'Las Condes' },
      { id: 3, name: 'Ñuñoa' },
      { id: 2, name: 'Providencia' },
      { id: 1, name: 'Santiago' },
      { id: 5, name: 'San Miguel' },
    ]),
  ),

  // ES-02: espacios del propietario (borradores).
  http.post('*/api/spaces', async ({ request }) => {
    const payload = (await request.json()) as SpacePayload
    const space = ownerSpace(`draft-${drafts.size + 1}`, payload)
    drafts.set(space.id, space)
    return HttpResponse.json(space, { status: 201 })
  }),
  http.get('*/api/spaces/:id', ({ params }) => {
    const space = drafts.get(String(params.id))
    return space
      ? HttpResponse.json(space)
      : HttpResponse.json({ message: 'El espacio no existe', error: 'Not Found', statusCode: 404 }, { status: 404 })
  }),
  http.patch('*/api/spaces/:id', async ({ params, request }) => {
    const id = String(params.id)
    const previous = drafts.get(id)
    if (!previous) {
      return HttpResponse.json({ message: 'El espacio no existe', error: 'Not Found', statusCode: 404 }, { status: 404 })
    }
    const space = ownerSpace(id, (await request.json()) as SpacePayload, previous)
    drafts.set(id, space)
    return HttpResponse.json(space)
  }),

  // ES-04 y ES-06: publicar y activar o desactivar.
  http.post('*/api/spaces/:id/publish', ({ params }) => {
    const space = drafts.get(String(params.id))
    if (!space) return notFound('El espacio no existe')
    if (space.status !== 'DRAFT') return conflict('El espacio ya está publicado')
    const missing = missingToPublish(space)
    if (missing.length > 0) return conflict('Faltan datos para publicar el espacio', { missing })
    const published: OwnerSpace = { ...space, status: 'ACTIVE' }
    drafts.set(space.id, published)
    return HttpResponse.json(published)
  }),
  http.patch('*/api/spaces/:id/status', async ({ params, request }) => {
    const space = drafts.get(String(params.id))
    if (!space) return notFound('El espacio no existe')
    const { status } = (await request.json()) as { status: 'ACTIVE' | 'INACTIVE' }
    if (space.status === 'DRAFT') return conflict('Un borrador no se activa ni se desactiva: publícalo primero')
    if (status === 'ACTIVE') {
      const missing = missingToPublish(space)
      if (missing.length > 0) return conflict('Faltan datos para publicar el espacio', { missing })
    }
    const next: OwnerSpace = { ...space, status }
    drafts.set(space.id, next)
    return HttpResponse.json(next)
  }),

  // ES-03: fotos del espacio (hasta 10; la de posición 0 es la portada).
  http.post('*/api/spaces/:id/photos', async ({ params, request }) => {
    const space = drafts.get(String(params.id))
    if (!space) return notFound('El espacio no existe')
    const { file } = Object.fromEntries(await request.formData())
    // No se usa `instanceof File`: en los tests el File del formulario (jsdom) y el que lee MSW (Node) son clases distintas.
    if (!file || typeof file === 'string') {
      return HttpResponse.json({ message: 'Falta la foto', statusCode: 400 }, { status: 400 })
    }
    if (space.photos.length >= 10) {
      return HttpResponse.json({ message: 'Un espacio puede tener hasta 10 fotos', statusCode: 409 }, { status: 409 })
    }
    const photo = mockPhoto(space.photos.length)
    drafts.set(space.id, { ...space, photos: [...space.photos, photo] })
    return HttpResponse.json(photo, { status: 201 })
  }),
  http.patch('*/api/spaces/:id/photos/order', async ({ params, request }) => {
    const space = drafts.get(String(params.id))
    if (!space) return notFound('El espacio no existe')
    const { photoIds } = (await request.json()) as { photoIds: string[] }
    const sameSet = photoIds.length === space.photos.length && space.photos.every((p) => photoIds.includes(p.id))
    if (!sameSet) {
      return HttpResponse.json({ message: 'La lista debe tener exactamente las fotos del espacio, sin repetir', statusCode: 400 }, { status: 400 })
    }
    const photos = photoIds.map((id, position) => ({ ...space.photos.find((p) => p.id === id)!, position }))
    drafts.set(space.id, { ...space, photos })
    return HttpResponse.json(photos)
  }),
  http.delete('*/api/spaces/:id/photos/:photoId', ({ params }) => {
    const space = drafts.get(String(params.id))
    if (!space) return notFound('El espacio no existe')
    if (!space.photos.some((p) => p.id === params.photoId)) return notFound('La foto no existe')
    const photos = space.photos.filter((p) => p.id !== params.photoId).map((p, position) => ({ ...p, position }))
    drafts.set(space.id, { ...space, photos })
    return new HttpResponse(null, { status: 204 })
  }),

  // BU-01: catálogo paginado, `{ items, total, page, pageSize }`.
  http.get('*/api/catalog', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 12)
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      items: catalogData.slice(start, start + pageSize),
      total: catalogData.length,
      page,
      pageSize,
    })
  }),

  // BU-02: detalle público; 404 si el espacio no existe.
  http.get('*/api/catalog/:id', ({ params }) => {
    const item = catalogData.find((space) => space.id === params.id)
    if (!item) {
      return HttpResponse.json({ message: 'El espacio no existe', error: 'Not Found', statusCode: 404 }, { status: 404 })
    }
    return HttpResponse.json(detailOf(item))
  }),
]

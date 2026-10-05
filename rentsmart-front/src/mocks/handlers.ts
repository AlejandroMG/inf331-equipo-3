import { http, HttpResponse } from 'msw'
import type { SpaceDetail } from '../features/catalog/types'
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

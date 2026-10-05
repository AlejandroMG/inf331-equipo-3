import { http, HttpResponse } from 'msw'
import { catalogData } from './catalog-data'

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
]

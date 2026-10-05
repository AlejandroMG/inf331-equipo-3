import { http, HttpResponse } from 'msw'

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

  // CU-01: registro. "existe@rentsmart.test" simula un email ya usado.
  http.post('*/api/auth/register', async ({ request }) => {
    const body = (await request.json()) as { email: string; name: string }
    const email = body.email.trim().toLowerCase()
    if (email === 'existe@rentsmart.test') {
      return HttpResponse.json({ message: 'Ya existe una cuenta con este email.' }, { status: 409 })
    }
    return HttpResponse.json(
      { id: 'mock-user', email, name: body.name, role: 'USER', isHost: false, createdAt: new Date().toISOString() },
      { status: 201 },
    )
  }),
]

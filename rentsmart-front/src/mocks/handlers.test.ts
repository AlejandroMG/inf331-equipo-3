import { describe, expect, it } from 'vitest'
import { http } from '../lib/http'

// Ejemplo de prueba contra un endpoint simulado con MSW: el cliente real llama a /api/space-types
// y recibe la respuesta de handlers.ts sin que exista el back.
describe('endpoint simulado /api/space-types', () => {
  it('devuelve los 8 tipos de espacio', async () => {
    const types = await http.get<{ id: number; name: string }[]>('/space-types')

    expect(types).toHaveLength(8)
    expect(types[0]).toEqual({ id: 1, name: 'Sala de reuniones' })
  })
})

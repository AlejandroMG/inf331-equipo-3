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

// PN-01: el panel del propietario lee GET /api/spaces/me.
describe('endpoint simulado /api/spaces/me', () => {
  const draft = (name: string, extra: object = {}) =>
    http.post('/spaces', {
      name, typeId: null, description: null, capacity: null, pricePerHour: null, pricePerDay: null,
      regionId: null, communeId: null, address: null, addressDetail: null, rules: null, amenityIds: [], ...extra,
    })

  it('sin espacios devuelve una lista vacía y "me" no se toma por un id', async () => {
    expect(await http.get('/spaces/me')).toEqual([])
  })

  it('lista los espacios con el resumen del contrato, los modificados más recientemente primero', async () => {
    await draft('Primero')
    await draft('Segundo', { typeId: 1, communeId: 1, pricePerHour: 9000, description: 'x', capacity: 4 })

    const list = await http.get<Array<Record<string, unknown>>>('/spaces/me')

    expect(list.map((space) => space.name)).toEqual(['Segundo', 'Primero'])
    expect(list[0]).toEqual({
      id: expect.any(String),
      status: 'DRAFT',
      name: 'Segundo',
      typeName: 'Sala de reuniones',
      communeName: 'Santiago',
      pricePerHour: 9000,
      pricePerDay: null,
      coverUrl: null,
      missing: ['photos'],
      blockedReason: null,
      updatedAt: expect.any(String),
    })
    expect(list[1].missing).toEqual(['type', 'description', 'capacity', 'commune', 'price', 'photos'])
    expect(list[1].typeName).toBeNull()
  })
})

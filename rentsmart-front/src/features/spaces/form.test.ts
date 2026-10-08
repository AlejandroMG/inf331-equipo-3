import { describe, expect, it } from 'vitest'
import { ApiError } from '../../lib/http'
import { emptyForm, missingFromError, publishChecklist, REQUIREMENTS, toForm, toPayload, validate } from './form'
import type { OwnerSpace, SpaceForm } from './types'

const filled: SpaceForm = {
  name: '  Sala Alameda ',
  typeId: '2',
  description: 'Luminosa',
  capacity: '10',
  amenityIds: [1, 3],
  rules: 'No fumar',
  communeId: '4',
  address: 'Av. Libertador 1234',
  addressDetail: 'Oficina 301',
  latitude: '-33.4489',
  longitude: '-70.6693',
  pricePerHour: '12000',
  pricePerDay: '90000',
}

describe('validate', () => {
  it('un formulario vacío solo exige el nombre', () => {
    expect(validate(emptyForm)).toEqual({ name: 'Ponle un nombre a tu espacio.' })
  })

  it('un nombre en blanco cuenta como vacío', () => {
    expect(validate({ ...emptyForm, name: '   ' }).name).toBeDefined()
  })

  it('el nombre no puede superar 100 caracteres', () => {
    expect(validate({ ...emptyForm, name: 'a'.repeat(101) }).name).toBe('El nombre no puede superar 100 caracteres.')
    expect(validate({ ...emptyForm, name: 'a'.repeat(100) })).toEqual({})
  })

  it('un formulario completo es válido', () => {
    expect(validate(filled)).toEqual({})
  })

  it.each([
    ['capacity', '0'],
    ['capacity', '-3'],
    ['capacity', '2.5'],
    ['capacity', 'abc'],
    ['capacity', '1001'],
    ['pricePerHour', '0'],
    ['pricePerHour', '10000001'],
    ['pricePerDay', '1.5'],
  ] as const)('%s con "%s" es inválido', (field, value) => {
    expect(validate({ ...filled, [field]: value })[field]).toBeDefined()
  })

  it('los límites son válidos', () => {
    expect(validate({ ...filled, capacity: '1000', pricePerHour: '1', pricePerDay: '10000000' })).toEqual({})
  })

  describe('punto en el mapa', () => {
    it('es opcional: sin coordenadas no hay error', () => {
      expect(validate({ ...filled, latitude: '', longitude: '' })).toEqual({})
    })

    it.each([
      ['latitude', 'norte'],
      ['latitude', '-16.9'],
      ['latitude', '-56.1'],
      ['latitude', '33.4'],
      ['longitude', 'oeste'],
      ['longitude', '-65.9'],
      ['longitude', '-110.1'],
      ['longitude', '70.6'],
    ] as const)('%s con "%s" es inválida', (field, value) => {
      expect(validate({ ...filled, [field]: value })[field]).toBeDefined()
    })

    it('los límites de Chile son válidos', () => {
      expect(validate({ ...filled, latitude: '-17', longitude: '-110' })).toEqual({})
      expect(validate({ ...filled, latitude: '-56', longitude: '-66' })).toEqual({})
    })

    it('si falta una de las dos, el error queda en la que falta', () => {
      expect(validate({ ...filled, longitude: '' })).toEqual({
        longitude: 'Falta la longitud: completa las dos o quita el punto.',
      })
      expect(validate({ ...filled, latitude: '  ' })).toEqual({
        latitude: 'Falta la latitud: completa las dos o quita el punto.',
      })
    })

    it('el mensaje de rango no se mezcla con el de la que falta', () => {
      expect(validate({ ...filled, latitude: '40', longitude: '' }).longitude).toBeUndefined()
    })
  })
})

describe('toPayload', () => {
  it('convierte el formulario en el cuerpo que espera el back', () => {
    expect(toPayload(filled, 1)).toEqual({
      name: 'Sala Alameda',
      typeId: 2,
      description: 'Luminosa',
      capacity: 10,
      pricePerHour: 12000,
      pricePerDay: 90000,
      regionId: 1,
      communeId: 4,
      address: 'Av. Libertador 1234',
      addressDetail: 'Oficina 301',
      latitude: -33.4489,
      longitude: -70.6693,
      rules: 'No fumar',
      amenityIds: [1, 3],
    })
  })

  it('manda las coordenadas con hasta 6 decimales, que es lo que acepta el back', () => {
    const payload = toPayload({ ...filled, latitude: '-33.44891234567', longitude: ' -70.6693 ' }, 1)

    expect(payload.latitude).toBe(-33.448912)
    expect(payload.longitude).toBe(-70.6693)
  })

  it('manda null en lo vacío, para que borrarlo en el formulario lo borre también en el servidor', () => {
    expect(toPayload({ ...emptyForm, name: 'Sala' }, null)).toEqual({
      name: 'Sala',
      typeId: null,
      description: null,
      capacity: null,
      pricePerHour: null,
      pricePerDay: null,
      regionId: null,
      communeId: null,
      address: null,
      addressDetail: null,
      latitude: null,
      longitude: null,
      rules: null,
      amenityIds: [],
    })
  })
})

describe('toForm', () => {
  const space: OwnerSpace = {
    id: 's1',
    status: 'DRAFT',
    name: 'Sala',
    typeId: 2,
    description: null,
    capacity: 10,
    pricePerHour: 12000,
    pricePerDay: null,
    regionId: 1,
    communeId: 4,
    address: 'Av. 1',
    addressDetail: null,
    latitude: null,
    longitude: null,
    rules: null,
    amenityIds: [1, 3],
    photos: [],
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  }

  it('pasa los valores nulos a texto vacío y los números a texto', () => {
    expect(toForm(space)).toEqual({
      name: 'Sala',
      typeId: '2',
      description: '',
      capacity: '10',
      amenityIds: [1, 3],
      rules: '',
      communeId: '4',
      address: 'Av. 1',
      addressDetail: '',
      latitude: '',
      longitude: '',
      pricePerHour: '12000',
      pricePerDay: '',
    })
  })

  it('pasa las coordenadas guardadas a texto', () => {
    expect(toForm({ ...space, latitude: -33.4489, longitude: -70.6693 })).toMatchObject({
      latitude: '-33.4489',
      longitude: '-70.6693',
    })
  })

  it('un formulario guardado y vuelto a cargar queda igual', () => {
    const form = toForm(space)

    expect(toForm({ ...space, ...toPayload(form, 1) })).toEqual(form)
  })
})

describe('publishChecklist', () => {
  const done = (form: SpaceForm, photoCount = 0) =>
    Object.fromEntries(publishChecklist(form, photoCount).map((i) => [i.label, i.done]))

  it('sin datos no hay nada listo', () => {
    expect(Object.values(done(emptyForm)).every((d) => !d)).toBe(true)
  })

  it('marca precio, capacidad y descripción según el formulario', () => {
    expect(done(filled)).toMatchObject({
      'Precio por hora o por día': true,
      Capacidad: true,
      Descripción: true,
    })
  })

  it('basta un precio, por hora o por día', () => {
    expect(done({ ...emptyForm, pricePerDay: '50000' })['Precio por hora o por día']).toBe(true)
    expect(done({ ...emptyForm, pricePerHour: '5000' })['Precio por hora o por día']).toBe(true)
  })

  it('una descripción en blanco no cuenta', () => {
    expect(done({ ...emptyForm, description: '   ' }).Descripción).toBe(false)
  })

  it('la foto se cuenta desde la primera subida', () => {
    expect(done(filled, 0)['Al menos una foto']).toBe(false)
    expect(done(filled, 1)['Al menos una foto']).toBe(true)
    expect(done(filled, 10)['Al menos una foto']).toBe(true)
  })

  it('el horario cuenta cuando el espacio tiene uno guardado (DI-01)', () => {
    const schedule = (has?: boolean) => publishChecklist(filled, 3, has).find((i) => i.code === 'schedule')?.done
    expect(schedule()).toBe(false)
    expect(schedule(false)).toBe(false)
    expect(schedule(true)).toBe(true)
  })
})

describe('publishChecklist: tipo y comuna (P-18)', () => {
  const byCode = (form: SpaceForm) => Object.fromEntries(publishChecklist(form, 0).map((i) => [i.code, i.done]))

  it('incluye todos los requisitos en el orden del formulario', () => {
    expect(publishChecklist(emptyForm, 0).map((i) => i.code)).toEqual([
      'type', 'description', 'capacity', 'commune', 'price', 'schedule', 'photos',
    ])
  })

  it('el tipo y la comuna cuentan cuando están elegidos', () => {
    expect(byCode(emptyForm)).toMatchObject({ type: false, commune: false })
    expect(byCode(filled)).toMatchObject({ type: true, commune: true })
  })

  it('cada requisito apunta al paso donde se completa', () => {
    expect(Object.fromEntries(publishChecklist(emptyForm, 0).map((i) => [i.code, i.step]))).toEqual({
      type: 1, description: 1, capacity: 1, commune: 2, price: 3, photos: 4, schedule: 3,
    })
  })
})

describe('missingFromError', () => {
  const conflict = (data: unknown) => new ApiError(409, 'Faltan datos', data)

  it('lee la lista de lo que falta de un 409 del back', () => {
    expect(missingFromError(conflict({ message: 'x', missing: ['price', 'photos'] }))).toEqual(['price', 'photos'])
  })

  it('ignora códigos que no conoce', () => {
    expect(missingFromError(conflict({ missing: ['price', 'algo-nuevo', 7] }))).toEqual(['price'])
  })

  it.each([
    ['un error sin cuerpo', new ApiError(500, 'caída')],
    ['un cuerpo sin missing', conflict({ message: 'x' })],
    ['un missing que no es lista', conflict({ missing: 'price' })],
    ['un cuerpo de texto', conflict('texto')],
    ['un error que no es de la API', new Error('x')],
    ['algo que no es un error', null],
  ])('devuelve null con %s', (_caso, error) => {
    expect(missingFromError(error)).toBeNull()
  })

  it('todos los códigos conocidos tienen nombre y paso', () => {
    for (const code of Object.keys(REQUIREMENTS)) {
      expect(REQUIREMENTS[code as keyof typeof REQUIREMENTS].label).not.toBe('')
    }
  })
})

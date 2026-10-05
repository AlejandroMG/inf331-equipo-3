import { describe, expect, it } from 'vitest'
import { emptyForm, publishChecklist, toForm, toPayload, validate } from './form'
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
      rules: 'No fumar',
      amenityIds: [1, 3],
    })
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
      pricePerHour: '12000',
      pricePerDay: '',
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

  it('el horario sigue pendiente hasta que se pueda cargar (DI-01)', () => {
    expect(done(filled, 3)['Horario semanal']).toBe(false)
  })
})

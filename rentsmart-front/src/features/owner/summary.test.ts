import { describe, expect, it } from 'vitest'
import { countByStatus, metaText, missingText, priceText } from './summary'
import type { OwnerSpaceSummary } from './types'

const space = (overrides: Partial<OwnerSpaceSummary> = {}): OwnerSpaceSummary => ({
  id: 's1',
  status: 'ACTIVE',
  name: 'Sala Alameda',
  typeName: 'Sala de reuniones',
  communeName: 'Santiago',
  pricePerHour: 12000,
  pricePerDay: null,
  coverUrl: null,
  missing: [],
  blockedReason: null,
  updatedAt: '2026-10-05T12:00:00.000Z',
  ...overrides,
})

describe('missingText', () => {
  it('nombra lo que falta en una frase corta', () => {
    expect(missingText(['photos'])).toBe('foto')
    expect(missingText(['photos', 'schedule'])).toBe('foto y horario')
    expect(missingText(['photos', 'price', 'schedule'])).toBe('foto, precio y horario')
  })

  it('usa los nombres de cada requisito', () => {
    expect(missingText(['type', 'description', 'capacity', 'commune'])).toBe('tipo de espacio, descripción, capacidad y comuna')
  })

  it('ignora los códigos que no conoce, incluso los heredados de Object', () => {
    expect(missingText(['photos', 'algo-nuevo', 'toString'])).toBe('foto')
  })

  it('sin nada que faltar devuelve un texto vacío', () => {
    expect(missingText([])).toBe('')
  })
})

describe('priceText', () => {
  it('muestra el precio por hora, por día o ambos', () => {
    expect(priceText({ pricePerHour: 12000, pricePerDay: null })).toBe('$12.000 / hora')
    expect(priceText({ pricePerHour: null, pricePerDay: 50000 })).toBe('$50.000 / día')
    expect(priceText({ pricePerHour: 12000, pricePerDay: 50000 })).toBe('$12.000 / hora · $50.000 / día')
  })

  it('avisa cuando todavía no tiene precio', () => {
    expect(priceText({ pricePerHour: null, pricePerDay: null })).toBe('Sin precio todavía')
  })
})

describe('metaText', () => {
  it('une tipo, comuna y precio', () => {
    expect(metaText(space())).toBe('Sala de reuniones · Santiago · $12.000 / hora')
  })

  it('en un borrador deja fuera lo que no tiene', () => {
    expect(metaText(space({ typeName: null, communeName: null, pricePerHour: null }))).toBe('Sin precio todavía')
    expect(metaText(space({ communeName: null }))).toBe('Sala de reuniones · $12.000 / hora')
  })
})

describe('countByStatus', () => {
  it('cuenta los espacios de cada estado', () => {
    const counts = countByStatus([
      { status: 'ACTIVE' },
      { status: 'ACTIVE' },
      { status: 'INACTIVE' },
      { status: 'DRAFT' },
      { status: 'BLOCKED' },
    ])

    expect(counts).toEqual({ ACTIVE: 2, INACTIVE: 1, DRAFT: 1, BLOCKED: 1 })
  })

  it('sin espacios todo es cero', () => {
    expect(countByStatus([])).toEqual({ ACTIVE: 0, INACTIVE: 0, DRAFT: 0, BLOCKED: 0 })
  })
})

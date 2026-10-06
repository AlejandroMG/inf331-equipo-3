import { describe, expect, it } from 'vitest'
import { hasFilters, MAX_SEARCH_LENGTH, noFilters, parseFilters, toSearchParams, type CatalogFilters } from './filters'

const parse = (search: string) => parseFilters(new URLSearchParams(search))

describe('parseFilters', () => {
  it('sin parámetros no hay filtros', () => {
    expect(parse('')).toEqual(noFilters)
  })

  it('lee todos los filtros de la URL', () => {
    expect(parse('q=sala&typeId=3&communeId=2&minCapacity=8&maxPrice=20000')).toEqual({
      q: 'sala',
      typeId: 3,
      communeId: 2,
      minCapacity: 8,
      maxPrice: 20000,
    })
  })

  it('el texto se recorta y se limita al largo que acepta la API', () => {
    expect(parse('q=%20%20sala%20luminosa%20').q).toBe('sala luminosa')
    expect(parse(`q=${'a'.repeat(MAX_SEARCH_LENGTH + 20)}`).q).toHaveLength(MAX_SEARCH_LENGTH)
    expect(parse('q=%20%20').q).toBe('')
  })

  it.each([
    ['typeId=abc'],
    ['typeId='],
    ['typeId=0'],
    ['typeId=-2'],
    ['typeId=1.5'],
    ['typeId=99999999999'],
    ['communeId=abc'],
    ['minCapacity=0'],
    ['minCapacity=1001'],
    ['maxPrice=0'],
    ['maxPrice=10000001'],
    ['maxPrice=1e3x'],
  ])('ignora el valor inválido de %s en vez de pasarlo a la API', (search) => {
    expect(parse(search)).toEqual(noFilters)
  })

  it('acepta los valores en los extremos permitidos', () => {
    expect(parse('minCapacity=1&maxPrice=10000000&typeId=2147483647')).toMatchObject({
      minCapacity: 1,
      maxPrice: 10_000_000,
      typeId: 2_147_483_647,
    })
  })

  it('un filtro inválido no impide leer los demás', () => {
    expect(parse('typeId=abc&communeId=4')).toEqual({ ...noFilters, communeId: 4 })
  })
})

describe('hasFilters', () => {
  it('es falso sin filtros y verdadero con cualquiera', () => {
    expect(hasFilters(noFilters)).toBe(false)
    const keys: Array<[keyof CatalogFilters, CatalogFilters[keyof CatalogFilters]]> = [
      ['q', 'sala'],
      ['typeId', 1],
      ['communeId', 1],
      ['minCapacity', 4],
      ['maxPrice', 10000],
    ]
    for (const [key, value] of keys) expect(hasFilters({ ...noFilters, [key]: value })).toBe(true)
  })
})

describe('toSearchParams', () => {
  it('sin filtros ni página queda vacío', () => {
    expect(toSearchParams(noFilters).toString()).toBe('')
  })

  it('solo incluye los filtros con valor, en un orden fijo', () => {
    const filters: CatalogFilters = { q: 'sala luminosa', typeId: 3, communeId: null, minCapacity: 8, maxPrice: 20000 }

    expect(toSearchParams(filters).toString()).toBe('q=sala+luminosa&typeId=3&minCapacity=8&maxPrice=20000')
  })

  it('agrega la página desde la segunda', () => {
    expect(toSearchParams(noFilters, 1).toString()).toBe('')
    expect(toSearchParams(noFilters, 2).toString()).toBe('page=2')
    expect(toSearchParams({ ...noFilters, typeId: 3 }, 4).toString()).toBe('typeId=3&page=4')
  })

  it('lo que se escribe se lee igual: sirve para compartir la búsqueda', () => {
    const filters: CatalogFilters = { q: 'café & té', typeId: 8, communeId: 3, minCapacity: 4, maxPrice: 30000 }

    expect(parseFilters(new URLSearchParams(toSearchParams(filters).toString()))).toEqual(filters)
  })
})

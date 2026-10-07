import { describe, expect, it } from 'vitest'
import { hasFilters, MAX_SEARCH_LENGTH, noFilters, parseFilters, toSearchParams, type CatalogFilters } from './filters'

const parse = (search: string) => parseFilters(new URLSearchParams(search))

describe('parseFilters', () => {
  it('sin parámetros no hay filtros, el precio es por hora y el orden es el de los más recientes', () => {
    expect(parse('')).toEqual(noFilters)
    expect(noFilters.priceUnit).toBe('hour')
    expect(noFilters.sort).toBe('recent')
  })

  it('lee todos los filtros de la URL', () => {
    expect(parse('q=sala&typeId=3&communeId=2&minCapacity=8&priceUnit=day&minPrice=30000&maxPrice=80000&sort=price_desc')).toEqual({
      q: 'sala',
      typeId: 3,
      communeId: 2,
      minCapacity: 8,
      priceUnit: 'day',
      minPrice: 30000,
      maxPrice: 80000,
      sort: 'price_desc',
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
    ['minPrice=0'],
    ['minPrice=abc'],
    ['minPrice=10000001'],
    ['maxPrice=0'],
    ['maxPrice=10000001'],
    ['maxPrice=1e3x'],
    ['priceUnit=week'],
    ['priceUnit='],
    ['sort=cheap'],
    ['sort='],
    ['sort=PRICE_ASC'],
  ])('ignora el valor inválido de %s en vez de pasarlo a la API', (search) => {
    expect(parse(search)).toEqual(noFilters)
  })

  it('acepta los valores en los extremos permitidos', () => {
    expect(parse('minCapacity=1&minPrice=1&maxPrice=10000000&typeId=2147483647')).toMatchObject({
      minCapacity: 1,
      minPrice: 1,
      maxPrice: 10_000_000,
      typeId: 2_147_483_647,
    })
  })

  it('un filtro inválido no impide leer los demás', () => {
    expect(parse('typeId=abc&communeId=4')).toEqual({ ...noFilters, communeId: 4 })
  })

  it('un precio mínimo mayor que el máximo se descarta (la API lo rechazaría) y se conserva el máximo', () => {
    expect(parse('minPrice=20000&maxPrice=10000')).toEqual({ ...noFilters, maxPrice: 10000 })
    expect(parse('minPrice=10000&maxPrice=10000')).toEqual({ ...noFilters, minPrice: 10000, maxPrice: 10000 })
  })

  it('reconoce los tres órdenes', () => {
    expect(parse('sort=recent').sort).toBe('recent')
    expect(parse('sort=price_asc').sort).toBe('price_asc')
    expect(parse('sort=price_desc').sort).toBe('price_desc')
  })

  it('"day" es la única unidad distinta de la hora', () => {
    expect(parse('priceUnit=day').priceUnit).toBe('day')
    expect(parse('priceUnit=hour').priceUnit).toBe('hour')
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
      ['minPrice', 5000],
      ['maxPrice', 10000],
    ]
    for (const [key, value] of keys) expect(hasFilters({ ...noFilters, [key]: value })).toBe(true)
  })

  it('el orden no es un filtro', () => {
    expect(hasFilters({ ...noFilters, sort: 'price_asc' })).toBe(false)
    expect(hasFilters({ ...noFilters, sort: 'price_asc', typeId: 2 })).toBe(true)
  })

  it('la unidad del precio sola no filtra nada', () => {
    expect(hasFilters({ ...noFilters, priceUnit: 'day' })).toBe(false)
    expect(hasFilters({ ...noFilters, priceUnit: 'day', maxPrice: 50000 })).toBe(true)
  })
})

describe('toSearchParams', () => {
  it('sin filtros ni página queda vacío', () => {
    expect(toSearchParams(noFilters).toString()).toBe('')
  })

  it('solo incluye los filtros con valor, en un orden fijo', () => {
    const filters: CatalogFilters = {
      q: 'sala luminosa',
      typeId: 3,
      communeId: null,
      minCapacity: 8,
      priceUnit: 'hour',
      minPrice: 5000,
      maxPrice: 20000,
      sort: 'recent',
    }

    expect(toSearchParams(filters).toString()).toBe('q=sala+luminosa&typeId=3&minCapacity=8&minPrice=5000&maxPrice=20000')
  })

  it('la unidad "por día" se escribe, aunque todavía no haya precios; "por hora" no', () => {
    expect(toSearchParams({ ...noFilters, priceUnit: 'day' }).toString()).toBe('priceUnit=day')
    expect(toSearchParams({ ...noFilters, priceUnit: 'day', minPrice: 30000, maxPrice: 80000 }).toString()).toBe(
      'priceUnit=day&minPrice=30000&maxPrice=80000',
    )
    expect(toSearchParams({ ...noFilters, priceUnit: 'hour', maxPrice: 20000 }).toString()).toBe('maxPrice=20000')
  })

  it('el orden se escribe solo si no es el normal, antes de la página', () => {
    expect(toSearchParams({ ...noFilters, sort: 'recent' }).toString()).toBe('')
    expect(toSearchParams({ ...noFilters, sort: 'price_asc' }).toString()).toBe('sort=price_asc')
    expect(toSearchParams({ ...noFilters, typeId: 3, sort: 'price_desc' }, 2).toString()).toBe('typeId=3&sort=price_desc&page=2')
  })

  it('agrega la página desde la segunda', () => {
    expect(toSearchParams(noFilters, 1).toString()).toBe('')
    expect(toSearchParams(noFilters, 2).toString()).toBe('page=2')
    expect(toSearchParams({ ...noFilters, typeId: 3 }, 4).toString()).toBe('typeId=3&page=4')
  })

  it('lo que se escribe se lee igual: sirve para compartir la búsqueda', () => {
    const filters: CatalogFilters = {
      q: 'café & té',
      typeId: 8,
      communeId: 3,
      minCapacity: 4,
      priceUnit: 'day',
      minPrice: 30000,
      maxPrice: 120000,
      sort: 'price_asc',
    }

    expect(parseFilters(new URLSearchParams(toSearchParams(filters).toString()))).toEqual(filters)
  })
})

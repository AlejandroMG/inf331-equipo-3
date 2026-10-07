import { afterEach, describe, expect, it, vi } from 'vitest'
import { noFilters, type CatalogFilters } from './filters'
import { clearHistory, describeSearch, HISTORY_KEY, MAX_RECENT_SEARCHES, readHistory, saveSearch, searchKey } from './search-history'

const search = (changes: Partial<CatalogFilters>): CatalogFilters => ({ ...noFilters, ...changes })
const stored = (value: unknown) => localStorage.setItem(HISTORY_KEY, JSON.stringify(value))

afterEach(() => vi.restoreAllMocks())

describe('searchKey', () => {
  it('no incluye el orden, y es la misma para búsquedas iguales', () => {
    expect(searchKey(search({ q: 'cocina', sort: 'price_asc' }))).toBe('q=cocina')
    expect(searchKey(search({ q: 'cocina' }))).toBe(searchKey(search({ q: 'cocina', sort: 'price_desc' })))
  })

  it('lleva los filtros en el orden fijo de la URL', () => {
    expect(searchKey(search({ communeId: 2, q: 'sala', typeId: 1 }))).toBe('q=sala&typeId=1&communeId=2')
  })
})

describe('saveSearch y readHistory', () => {
  it('sin nada guardado el historial está vacío', () => {
    expect(readHistory()).toEqual([])
  })

  it('guarda una búsqueda y la deja leer', () => {
    saveSearch(search({ q: 'cocina' }), 1000)

    expect(readHistory()).toEqual([{ params: 'q=cocina', savedAt: 1000 }])
  })

  it('la más reciente va primero', () => {
    saveSearch(search({ q: 'cocina' }), 1)
    saveSearch(search({ typeId: 3 }), 2)

    expect(readHistory().map((e) => e.params)).toEqual(['typeId=3', 'q=cocina'])
  })

  it('repetir una búsqueda la sube al principio en vez de duplicarla', () => {
    saveSearch(search({ q: 'cocina' }), 1)
    saveSearch(search({ typeId: 3 }), 2)
    saveSearch(search({ q: 'cocina', sort: 'price_asc' }), 3)

    expect(readHistory()).toEqual([
      { params: 'q=cocina', savedAt: 3 },
      { params: 'typeId=3', savedAt: 2 },
    ])
  })

  it('guarda como máximo las últimas 6 y descarta las más antiguas', () => {
    for (let i = 1; i <= MAX_RECENT_SEARCHES + 3; i++) saveSearch(search({ q: `sala ${i}` }), i)

    const entries = readHistory()
    expect(entries).toHaveLength(MAX_RECENT_SEARCHES)
    expect(entries[0].params).toBe('q=sala+9')
    expect(entries.at(-1)?.params).toBe('q=sala+4')
  })

  it('una búsqueda sin filtros no se guarda', () => {
    saveSearch(search({ sort: 'price_asc' }))
    saveSearch(search({ priceUnit: 'day' }))

    expect(readHistory()).toEqual([])
  })

  it('devuelve la lista que quedó', () => {
    saveSearch(search({ q: 'a' }), 1)

    expect(saveSearch(search({ q: 'b' }), 2).map((e) => e.params)).toEqual(['q=b', 'q=a'])
  })
})

describe('readHistory con datos dañados', () => {
  it.each([
    ['JSON roto', '{no es json'],
    ['algo que no es una lista', '{"params":"q=a"}'],
  ])('%s: queda vacío', (_name, raw) => {
    localStorage.setItem(HISTORY_KEY, raw)

    expect(readHistory()).toEqual([])
  })

  it('descarta las entradas inválidas y se queda con las buenas', () => {
    stored([
      null,
      'texto',
      { params: 5, savedAt: 1 },
      { params: 'q=ok', savedAt: 'ayer' },
      { params: 'sort=price_asc', savedAt: 3 },
      { params: 'q=' + 'a'.repeat(600), savedAt: 4 },
      { params: 'q=buena', savedAt: 5 },
    ])

    expect(readHistory()).toEqual([{ params: 'q=buena', savedAt: 5 }])
  })

  it('normaliza las URL a mano y no deja repetidas', () => {
    stored([
      { params: 'communeId=2&q=sala&sort=price_desc&page=3', savedAt: 2 },
      { params: 'q=sala&communeId=2', savedAt: 1 },
    ])

    expect(readHistory()).toEqual([{ params: 'q=sala&communeId=2', savedAt: 2 }])
  })

  it('ignora los filtros con valores fuera de rango', () => {
    stored([{ params: 'typeId=-4&minCapacity=99999', savedAt: 1 }])

    expect(readHistory()).toEqual([])
  })

  it('lee como mucho 6 aunque haya más guardadas', () => {
    stored(Array.from({ length: 10 }, (_, i) => ({ params: `q=s${i}`, savedAt: i })))

    expect(readHistory()).toHaveLength(MAX_RECENT_SEARCHES)
  })
})

describe('clearHistory', () => {
  it('borra todo', () => {
    saveSearch(search({ q: 'cocina' }))

    expect(clearHistory()).toEqual([])
    expect(readHistory()).toEqual([])
  })
})

describe('sin almacenamiento', () => {
  it('leer y guardar no fallan, y la lista devuelta sigue sirviendo', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    expect(readHistory()).toEqual([])
    expect(saveSearch(search({ q: 'cocina' }), 1)).toEqual([{ params: 'q=cocina', savedAt: 1 }])
    expect(clearHistory()).toEqual([])
  })
})

describe('describeSearch', () => {
  const options = {
    types: [{ id: 1, name: 'Sala de reuniones' }],
    communes: [{ id: 2, name: 'Providencia' }],
  }

  it('dice cada filtro en palabras, separados por un punto', () => {
    expect(describeSearch(search({ q: 'luz', typeId: 1, communeId: 2, minCapacity: 8 }), options)).toBe(
      '“luz” · Sala de reuniones · Providencia · 8 personas o más',
    )
  })

  it.each([
    [{ minPrice: 5000, maxPrice: 20000 }, '$5.000 a $20.000 por hora'],
    [{ minPrice: 5000 }, 'desde $5.000 por hora'],
    [{ maxPrice: 20000 }, 'hasta $20.000 por hora'],
    [{ maxPrice: 90000, priceUnit: 'day' as const }, 'hasta $90.000 por día'],
  ])('el precio %j se dice «%s»', (changes, text) => {
    expect(describeSearch(search(changes), options)).toBe(text)
  })

  it('sin las opciones cargadas, o con un id que no existe, se queda con lo que sí sabe', () => {
    expect(describeSearch(search({ q: 'luz', typeId: 1, communeId: 2 }))).toBe('“luz”')
    expect(describeSearch(search({ typeId: 99 }), options)).toBe('Búsqueda guardada')
  })
})

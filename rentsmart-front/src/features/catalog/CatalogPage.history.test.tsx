import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'
import { HISTORY_KEY, readHistory, SAVE_AFTER_MS } from './search-history'

// El historial se guarda cuando la búsqueda lleva un rato en pantalla: los tests adelantan el reloj.
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

function renderCatalog(path = '/') {
  const router = createMemoryRouter([{ path: '/', element: <CatalogPage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const recentPanel = () => screen.queryByRole('navigation', { name: 'Búsquedas recientes' })
const stored = (params: string[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(params.map((p, i) => ({ params: p, savedAt: i }))))

describe('CatalogPage: búsquedas recientes (BU-07)', () => {
  it('la primera vez no hay historial', async () => {
    renderCatalog()
    await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })
    await wait(SAVE_AFTER_MS + 100)

    expect(recentPanel()).not.toBeInTheDocument()
    expect(readHistory()).toEqual([])
  })

  it('una búsqueda con resultados que se queda en pantalla se guarda y aparece en el panel', async () => {
    renderCatalog('/?q=cocina')
    await screen.findByRole('heading', { level: 3, name: 'Cocina taller Providencia' })
    expect(recentPanel()).not.toBeInTheDocument()

    await wait(SAVE_AFTER_MS + 100)

    expect(readHistory().map((e) => e.params)).toEqual(['q=cocina'])
    expect(screen.getByRole('link', { name: '“cocina”' })).toHaveAttribute('aria-current', 'true')
  })

  it('no se guarda antes de tiempo: armar la búsqueda paso a paso no deja un rastro por cada paso', async () => {
    const router = renderCatalog('/?q=sala')
    await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })
    await wait(SAVE_AFTER_MS - 1000)

    await act(() => router.navigate('/?q=sala+de+ensayo'))
    await screen.findByRole('heading', { level: 3, name: 'Sala de ensayo Los Olivos' })
    await wait(SAVE_AFTER_MS - 1000)
    expect(readHistory()).toEqual([])

    await wait(1500)
    expect(readHistory().map((e) => e.params)).toEqual(['q=sala+de+ensayo'])
  })

  it('una búsqueda sin resultados no se guarda', async () => {
    renderCatalog('/?q=zzzz')
    await screen.findByText('No encontramos espacios con esos filtros')

    await wait(SAVE_AFTER_MS + 100)

    expect(readHistory()).toEqual([])
    expect(recentPanel()).not.toBeInTheDocument()
  })

  it('sin filtros, solo con un orden, no se guarda', async () => {
    renderCatalog('/?sort=price_asc')
    await screen.findAllByRole('heading', { level: 3 })

    await wait(SAVE_AFTER_MS + 100)

    expect(readHistory()).toEqual([])
  })

  it('cambiar de página no guarda otra entrada', async () => {
    renderCatalog('/?q=sala&page=1')
    await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })
    await wait(SAVE_AFTER_MS + 100)

    expect(readHistory()).toHaveLength(1)
  })

  it('con búsquedas guardadas, el panel aparece de entrada, con cada una dicha en palabras', async () => {
    stored(['q=cocina&communeId=2', 'typeId=1'])
    renderCatalog()

    expect(await screen.findByRole('link', { name: '“cocina” · Providencia' })).toHaveAttribute('href', '/?q=cocina&communeId=2')
    expect(screen.getByRole('link', { name: 'Sala de reuniones' })).toHaveAttribute('href', '/?typeId=1')
  })

  it('repetir una búsqueda desde el panel aplica sus filtros y los deja en la URL', async () => {
    stored(['q=cocina&communeId=2'])
    const router = renderCatalog()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(await screen.findByRole('link', { name: '“cocina” · Providencia' }))

    expect(await screen.findByRole('heading', { level: 3, name: 'Cocina taller Providencia' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(router.state.location.search).toBe('?q=cocina&communeId=2')
    expect(screen.getByRole('searchbox', { name: 'Buscar espacios' })).toHaveValue('cocina')
  })

  it('"Borrar historial" lo vacía y esconde el panel', async () => {
    stored(['q=cocina', 'typeId=1'])
    renderCatalog()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(await screen.findByRole('button', { name: 'Borrar historial' }))

    expect(recentPanel()).not.toBeInTheDocument()
    expect(readHistory()).toEqual([])
  })

  it('un historial dañado en el almacenamiento no rompe el catálogo', async () => {
    localStorage.setItem(HISTORY_KEY, '{esto no es json')
    renderCatalog()

    expect(await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(recentPanel()).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RecentSearches } from './RecentSearches'

const options = { types: [{ id: 1, name: 'Sala de reuniones' }], communes: [{ id: 2, name: 'Providencia' }] }
const entries = [
  { params: 'q=cocina&communeId=2', savedAt: 2 },
  { params: 'typeId=1', savedAt: 1 },
]

function renderRecent(props: Partial<Parameters<typeof RecentSearches>[0]> = {}) {
  const onClear = vi.fn()
  render(
    <MemoryRouter>
      <RecentSearches entries={entries} currentKey="" options={options} onClear={onClear} {...props} />
    </MemoryRouter>,
  )
  return { onClear }
}

describe('RecentSearches', () => {
  it('sin historial no muestra nada', () => {
    renderRecent({ entries: [] })

    expect(screen.queryByRole('navigation', { name: 'Búsquedas recientes' })).not.toBeInTheDocument()
  })

  it('muestra cada búsqueda dicha en palabras, como un enlace a su URL', () => {
    renderRecent()

    const nav = screen.getByRole('navigation', { name: 'Búsquedas recientes' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '“cocina” · Providencia' })).toHaveAttribute('href', '/?q=cocina&communeId=2')
    expect(screen.getByRole('link', { name: 'Sala de reuniones' })).toHaveAttribute('href', '/?typeId=1')
  })

  it('marca la búsqueda que está en pantalla', () => {
    renderRecent({ currentKey: 'typeId=1' })

    expect(screen.getByRole('link', { name: 'Sala de reuniones' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: '“cocina” · Providencia' })).not.toHaveAttribute('aria-current')
  })

  it('"Borrar historial" avisa', async () => {
    const { onClear } = renderRecent()

    await userEvent.click(screen.getByRole('button', { name: 'Borrar historial' }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

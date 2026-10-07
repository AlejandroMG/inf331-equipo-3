import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Pagination } from './Pagination'

function renderPagination(page: number, totalPages: number) {
  render(
    <MemoryRouter>
      <Pagination page={page} totalPages={totalPages} hrefFor={(n) => `?page=${n}`} />
    </MemoryRouter>,
  )
}

describe('Pagination', () => {
  it('no se muestra si hay una sola página', () => {
    renderPagination(1, 1)

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('marca la página actual y enlaza a las demás', () => {
    renderPagination(2, 3)

    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Página 1' })).toHaveAttribute('href', '/?page=1')
    expect(screen.getByRole('link', { name: 'Página 3' })).not.toHaveAttribute('aria-current')
  })

  it('en la primera página "Anterior" no es un enlace', () => {
    renderPagination(1, 3)

    expect(screen.queryByRole('link', { name: 'Anterior' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Siguiente' })).toHaveAttribute('href', '/?page=2')
  })

  it('en la última página "Siguiente" no es un enlace', () => {
    renderPagination(3, 3)

    expect(screen.queryByRole('link', { name: 'Siguiente' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute('href', '/?page=2')
  })
})

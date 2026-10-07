import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SpaceCard } from './SpaceCard'
import type { CatalogItem } from './types'

const base: CatalogItem = {
  id: 'abc',
  name: 'Sala Alameda',
  typeName: 'Sala de reuniones',
  communeName: 'Santiago',
  capacity: 10,
  pricePerHour: 12000,
  pricePerDay: 90000,
  coverUrl: null,
}

function renderCard(overrides: Partial<CatalogItem> = {}) {
  render(
    <MemoryRouter>
      <SpaceCard space={{ ...base, ...overrides }} />
    </MemoryRouter>,
  )
}

describe('SpaceCard', () => {
  it('muestra tipo, nombre, comuna y capacidad, y lleva al detalle', () => {
    renderCard()

    expect(screen.getByRole('link')).toHaveAttribute('href', '/spaces/abc')
    expect(screen.getByRole('heading', { level: 3, name: 'Sala Alameda' })).toBeInTheDocument()
    expect(screen.getByText('Sala de reuniones')).toBeInTheDocument()
    expect(screen.getByText('Santiago')).toBeInTheDocument()
    expect(screen.getByText('Hasta 10 personas')).toBeInTheDocument()
  })

  it('muestra el precio por hora y por día', () => {
    renderCard()

    const card = screen.getByRole('link')

    expect(card).toHaveTextContent('$12.000')
    expect(card).toHaveTextContent('/ hora')
    expect(card).toHaveTextContent('o $90.000 / día')
  })

  it('con solo precio por hora no muestra precio por día', () => {
    renderCard({ pricePerDay: null })

    expect(screen.getByRole('link')).not.toHaveTextContent('/ día')
  })

  it('con solo precio por día lo muestra como precio principal', () => {
    renderCard({ pricePerHour: null })

    const card = screen.getByRole('link')

    expect(card).toHaveTextContent('$90.000')
    expect(card).toHaveTextContent('/ día')
    expect(card).not.toHaveTextContent('/ hora')
    expect(card).not.toHaveTextContent('o $90.000')
  })

  it('usa la foto de portada cuando existe', () => {
    renderCard({ coverUrl: 'https://fotos.test/portada.jpg' })

    // La foto es decorativa: el nombre del espacio ya está en el título, por eso alt vacío.
    expect(screen.getByRole('link').querySelector('img')).toHaveAttribute('src', 'https://fotos.test/portada.jpg')
  })

  it('sin foto muestra un marcador en vez de una imagen', () => {
    renderCard()

    expect(screen.getByRole('link').querySelector('img')).toBeNull()
  })

  it('tiene el corazón de favoritos fuera del enlace, con el nombre del espacio', () => {
    renderCard()

    const heart = screen.getByRole('button', { name: 'Guardar en favoritos: Sala Alameda' })
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    // Un botón dentro de un enlace no es HTML válido: el corazón es hermano del enlace, no su hijo.
    expect(screen.getByRole('link')).not.toContainElement(heart)
  })
})

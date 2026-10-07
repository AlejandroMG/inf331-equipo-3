import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Gallery } from './Gallery'

const photos = [
  { id: 'a', url: 'https://fotos.test/a.jpg', position: 0 },
  { id: 'b', url: 'https://fotos.test/b.jpg', position: 1 },
  { id: 'c', url: 'https://fotos.test/c.jpg', position: 2 },
]

describe('Gallery', () => {
  it('muestra la portada como foto principal', () => {
    render(<Gallery photos={photos} name="Sala Alameda" />)

    expect(screen.getByRole('img', { name: 'Sala Alameda, foto 1 de 3' })).toHaveAttribute('src', 'https://fotos.test/a.jpg')
    expect(screen.getByText('Foto 1 de 3 · portada')).toBeInTheDocument()
  })

  it('al elegir una miniatura cambia la foto principal y marca la miniatura', async () => {
    render(<Gallery photos={photos} name="Sala Alameda" />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver foto 3' }))

    expect(screen.getByRole('img', { name: 'Sala Alameda, foto 3 de 3' })).toHaveAttribute('src', 'https://fotos.test/c.jpg')
    expect(screen.getByRole('button', { name: 'Ver foto 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ver foto 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Foto 3 de 3')).toBeInTheDocument()
  })

  it('con una sola foto no muestra miniaturas', () => {
    render(<Gallery photos={[photos[0]]} name="Sala Alameda" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sin fotos muestra un marcador y ningún control', () => {
    render(<Gallery photos={[]} name="Sala Alameda" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Foto \d/)).not.toBeInTheDocument()
  })
})

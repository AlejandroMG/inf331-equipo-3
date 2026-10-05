import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Button, LinkButton } from './Button'

describe('Button', () => {
  it('es type="button" por defecto, para no enviar formularios sin querer', () => {
    render(<Button>Guardar</Button>)

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('llama a onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('con loading se bloquea y avisa que está ocupado', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Guardando
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Guardando' })

    await userEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('no marca aria-busy cuando no está cargando', () => {
    render(<Button>Guardar</Button>)

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })
})

describe('LinkButton', () => {
  it('es un enlace de navegación con aspecto de botón', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/publish">Publicar</LinkButton>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Publicar' })).toHaveAttribute('href', '/publish')
  })
})

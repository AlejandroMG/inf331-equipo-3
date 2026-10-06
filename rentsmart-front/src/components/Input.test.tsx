import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('asocia la etiqueta con el campo', async () => {
    render(<Input label="Nombre del espacio" />)

    const input = screen.getByLabelText('Nombre del espacio')
    await userEvent.type(input, 'Sala Alameda')

    expect(input).toHaveValue('Sala Alameda')
  })

  it('muestra el error y marca el campo como inválido', () => {
    render(<Input label="Capacidad" error="Ingresa un número mayor que 0." />)

    const input = screen.getByLabelText('Capacidad')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Ingresa un número mayor que 0.')
  })

  it('muestra la ayuda como descripción del campo', () => {
    render(<Input label="Dirección" hint="Es la que ven todos." />)

    const input = screen.getByLabelText('Dirección')

    expect(input).toHaveAccessibleDescription('Es la que ven todos.')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('el error tiene prioridad sobre la ayuda', () => {
    render(<Input label="Dirección" hint="Es la que ven todos." error="Obligatorio" />)

    expect(screen.getByLabelText('Dirección')).toHaveAccessibleDescription('Obligatorio')
  })

  it('respeta un id propio', () => {
    render(<Input label="Región" id="region" />)

    expect(screen.getByLabelText('Región')).toHaveAttribute('id', 'region')
  })
})

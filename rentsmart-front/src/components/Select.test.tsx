import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'
import { Textarea } from './Textarea'

const options = [
  { value: '1', label: 'Santiago' },
  { value: '2', label: 'Providencia' },
]

describe('Select', () => {
  it('asocia la etiqueta y muestra el marcador y las opciones', () => {
    render(<Select label="Comuna" options={options} placeholder="Selecciona una comuna" onChange={() => undefined} value="" />)

    const select = screen.getByLabelText('Comuna')

    expect(select).toHaveValue('')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Selecciona una comuna', 'Santiago', 'Providencia'])
  })

  it('avisa del valor elegido', async () => {
    // Se lee el valor dentro del manejador: el select es controlado y vuelve a "1" apenas termina el evento.
    const onChange = vi.fn((e: { target: { value: string } }) => e.target.value)
    render(<Select label="Comuna" options={options} onChange={onChange} value="1" />)

    await userEvent.selectOptions(screen.getByLabelText('Comuna'), 'Providencia')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.results[0].value).toBe('2')
  })

  it('sin marcador no agrega una opción vacía', () => {
    render(<Select label="Comuna" options={options} onChange={() => undefined} value="1" />)

    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('muestra el error como descripción y marca el campo inválido', () => {
    render(<Select label="Comuna" options={options} error="Elige una comuna" hint="Ayuda" onChange={() => undefined} value="" />)

    const select = screen.getByLabelText('Comuna')

    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Elige una comuna')
  })

  it('muestra la ayuda cuando no hay error', () => {
    render(<Select label="Región" options={options} hint="Solo la Metropolitana" disabled onChange={() => undefined} value="1" />)

    expect(screen.getByLabelText('Región')).toHaveAccessibleDescription('Solo la Metropolitana')
    expect(screen.getByLabelText('Región')).toBeDisabled()
  })
})

describe('Textarea', () => {
  it('asocia la etiqueta y recibe texto', async () => {
    render(<Textarea label="Descripción" />)

    const textarea = screen.getByLabelText('Descripción')
    await userEvent.type(textarea, 'Sala luminosa')

    expect(textarea).toHaveValue('Sala luminosa')
  })

  it('muestra el error como descripción y marca el campo inválido', () => {
    render(<Textarea label="Descripción" error="Muy larga" />)

    const textarea = screen.getByLabelText('Descripción')

    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveAccessibleDescription('Muy larga')
  })

  it('muestra la ayuda', () => {
    render(<Textarea label="Reglas" hint="Opcional" />)

    expect(screen.getByLabelText('Reglas')).toHaveAccessibleDescription('Opcional')
  })
})

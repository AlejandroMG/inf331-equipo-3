import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toast-context'

function Trigger() {
  const toast = useToast()
  return (
    <>
      <button type="button" onClick={() => toast.show('Guardado')}>
        éxito
      </button>
      <button type="button" onClick={() => toast.show('Falló la subida', 'error')}>
        error
      </button>
    </>
  )
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

describe('ToastProvider', () => {
  afterEach(() => vi.useRealTimers())

  it('muestra un aviso de éxito como estado', async () => {
    renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'éxito' }))

    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
  })

  it('muestra un aviso de error como alerta', async () => {
    renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'error' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Falló la subida')
  })

  it('apila varios avisos', async () => {
    renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'éxito' }))
    await userEvent.click(screen.getByRole('button', { name: 'error' }))

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('se cierra solo a los 5 segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderToasts()
    await userEvent.click(screen.getByRole('button', { name: 'éxito' }))

    act(() => vi.advanceTimersByTime(4900))
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('se cierra con el botón', async () => {
    renderToasts()
    await userEvent.click(screen.getByRole('button', { name: 'éxito' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('useToast', () => {
  it('falla con un mensaje claro fuera del ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderHook(() => useToast())).toThrow('useToast debe usarse dentro de <ToastProvider>')

    vi.restoreAllMocks()
  })
})

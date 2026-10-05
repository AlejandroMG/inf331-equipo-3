import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

function renderModal(open: boolean, onClose = vi.fn()) {
  const ui = (isOpen: boolean) => (
    <Modal open={isOpen} onClose={onClose} title="¿Desactivar el espacio?" footer={<button type="button">Confirmar</button>}>
      Saldrá del catálogo.
    </Modal>
  )
  const view = render(ui(open))
  return { onClose, rerender: (isOpen: boolean) => view.rerender(ui(isOpen)) }
}

describe('Modal', () => {
  it('abierto muestra el título, el contenido y las acciones', () => {
    renderModal(true)

    const dialog = screen.getByRole('dialog', { name: '¿Desactivar el espacio?' })

    expect(dialog).toHaveTextContent('Saldrá del catálogo.')
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('cerrado no se muestra', () => {
    renderModal(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('se abre y se cierra al cambiar open, sin avisar con onClose', () => {
    const { onClose, rerender } = renderModal(false)

    rerender(true)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('avisa con onClose cuando el navegador lo cierra (Esc)', () => {
    const { onClose } = renderModal(true)

    fireEvent(screen.getByRole('dialog'), new Event('close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cierra al hacer clic en el fondo, no dentro del contenido', async () => {
    const { onClose } = renderModal(true)

    await userEvent.click(screen.getByText('Saldrá del catálogo.'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

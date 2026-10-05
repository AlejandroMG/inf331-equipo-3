import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Botones de acción, alineados a la derecha. */
  footer?: ReactNode
}

// Usa <dialog> nativo: el navegador atrapa el foco, cierra con Esc y bloquea el fondo.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Esc y dialog.close() disparan "close"; si ya estaba cerrado por props no se avisa de nuevo.
      onClose={() => {
        if (open) onClose()
      }}
      // El contenido ocupa todo el <dialog>, así que solo el fondo oscurecido llega con target === dialog.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/45"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
      </div>
    </dialog>
  )
}

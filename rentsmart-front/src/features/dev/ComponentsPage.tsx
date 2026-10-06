import { useState } from 'react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toast-context'
import { formatClp } from '../../lib/format'

/** Guía de los componentes base. Solo existe en desarrollo (ver routes.tsx). */
export function ComponentsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  function simulateRequest() {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      toast.show('Cambios guardados como borrador')
    }, 1200)
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Componentes base</h1>
        <p className="mt-2 text-muted">Guía interna de F-07. No aparece en producción.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted">Button</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Reservar y pagar</Button>
            <Button variant="secondary">Cancelar</Button>
            <Button variant="outline">Publicar tu espacio</Button>
            <Button variant="link">Limpiar filtros</Button>
            <Button disabled>Deshabilitado</Button>
            <Button loading={loading} onClick={simulateRequest}>
              {loading ? 'Guardando…' : 'Guardar borrador'}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted">Input</h2>
          <div className="flex flex-col gap-4">
            <Input label="Nombre del espacio" defaultValue="Sala Alameda" />
            <Input label="Capacidad (personas)" type="number" defaultValue={0} error="Ingresa un número mayor que 0." />
            <Input label="Dirección" hint="Es la que ven todos en el catálogo." placeholder="Calle y número" />
            <Input label="Región" defaultValue="Región Metropolitana" disabled />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted">Card</h2>
          <Card className="max-w-xs overflow-hidden p-0">
            <div className="h-32 bg-gradient-to-br from-primary-soft to-accent-soft" />
            <div className="flex flex-col gap-1 p-4">
              <span className="text-[13px] font-semibold text-muted">Sala de reuniones</span>
              <span className="font-display text-lg font-bold">Sala Alameda</span>
              <span className="text-sm text-muted">Santiago · Hasta 10 personas</span>
              <span className="mt-1.5 text-lg font-bold">
                {formatClp(12000)} <span className="text-sm font-normal text-muted">/ hora</span>
              </span>
            </div>
          </Card>
        </Card>

        <Card>
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted">Modal y Toast</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Abrir modal
            </Button>
            <Button variant="secondary" onClick={() => toast.show('Cambios guardados como borrador')}>
              Aviso de éxito
            </Button>
            <Button variant="secondary" onClick={() => toast.show('No se pudo subir la foto. Revisa el formato y el tamaño.', 'error')}>
              Aviso de error
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="¿Desactivar “Sala Alameda”?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModalOpen(false)}>Desactivar</Button>
          </>
        }
      >
        Saldrá del catálogo y no recibirá reservas nuevas. Las reservas confirmadas se mantienen.
      </Modal>
    </div>
  )
}

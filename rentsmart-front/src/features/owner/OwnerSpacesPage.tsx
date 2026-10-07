import { useState } from 'react'
import { Button, LinkButton } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/toast-context'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { missingFromError } from '../spaces/form'
import { changeSpaceStatus } from '../spaces/spaces-api'
import { fetchMySpaces } from './owner-api'
import { OwnerSpaceRow } from './OwnerSpaceRow'
import { countByStatus, missingText } from './summary'
import type { OwnerSpaceSummary } from './types'

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <li className="rounded-card border border-line bg-white px-3 py-3 sm:px-5 sm:py-[18px]">
      <div className="font-display text-2xl font-bold leading-tight sm:text-[32px]">{value}</div>
      <div className="mt-0.5 text-[13px] leading-snug text-muted sm:text-sm">{label}</div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li aria-hidden="true" className="flex items-center gap-4 rounded-card border border-line bg-white p-4">
      <div className="h-[72px] w-[88px] motion-safe:animate-pulse rounded-xl bg-line/60" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-5 w-1/2 motion-safe:animate-pulse rounded bg-line/60" />
        <div className="h-3 w-2/3 motion-safe:animate-pulse rounded bg-line/60" />
      </div>
    </li>
  )
}

/** Panel del propietario (PN-01): sus espacios con el estado de cada uno y los accesos a editar y activar o desactivar. */
export function OwnerSpacesPage() {
  usePageTitle('Mis espacios')
  const toast = useToast()
  const { data, error, loading, retry } = useRequest('owner-spaces', fetchMySpaces)
  // El estado que devolvió el servidor al activar o desactivar; tapa el de la lista cargada sin recargarla.
  const [statuses, setStatuses] = useState<Record<string, OwnerSpaceSummary['status']>>({})
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [confirming, setConfirming] = useState<OwnerSpaceSummary | null>(null)

  const spaces = data?.map((space) => ({ ...space, status: statuses[space.id] ?? space.status }))
  const counts = countByStatus(spaces ?? [])

  async function change(space: OwnerSpaceSummary, status: 'ACTIVE' | 'INACTIVE') {
    setPending((current) => new Set(current).add(space.id))
    try {
      const updated = await changeSpaceStatus(space.id, status)
      setStatuses((current) => ({ ...current, [space.id]: updated.status }))
      toast.show(status === 'ACTIVE' ? `«${space.name}» ya está en el catálogo.` : `«${space.name}» salió del catálogo.`)
    } catch (failure) {
      const missing = missingFromError(failure)
      toast.show(
        missing && missing.length > 0
          ? `No se puede activar «${space.name}»: falta ${missingText(missing)}.`
          : failure instanceof Error
            ? failure.message
            : 'No pudimos cambiar el estado. Intenta de nuevo.',
        'error',
      )
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(space.id)
        return next
      })
    }
  }

  // Activar no necesita confirmación; desactivar saca la publicación del catálogo y la pide.
  function toggle(space: OwnerSpaceSummary) {
    if (space.status === 'ACTIVE') setConfirming(space)
    else void change(space, 'ACTIVE')
  }

  async function confirmDeactivation() {
    if (!confirming) return
    await change(confirming, 'INACTIVE')
    setConfirming(null)
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Mis espacios</h1>
          <p className="mt-1.5 text-[15px] text-muted">Administra tus publicaciones y revisa tus próximas reservas.</p>
        </div>
        <LinkButton to={paths.publish}>Publicar nuevo espacio</LinkButton>
      </div>

      {loading && (
        <div role="status" aria-label="Cargando tus espacios" className="mt-8">
          <ul className="flex flex-col gap-3.5">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-8 flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tus espacios.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {spaces && spaces.length === 0 && (
        <div className="mt-8 rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
          <h2 className="font-display text-xl font-bold">Todavía no tienes espacios</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Publica el primero: te guiamos paso a paso y tu avance se guarda como borrador.
          </p>
          <LinkButton to={paths.publish} className="mt-6">
            Publicar un espacio
          </LinkButton>
        </div>
      )}

      {spaces && spaces.length > 0 && (
        <>
          <ul aria-label="Resumen" className="my-6 grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:gap-4">
            <Tile value={counts.ACTIVE} label="Activos en el catálogo" />
            <Tile value={counts.INACTIVE} label="Inactivos" />
            <Tile value={counts.DRAFT} label="Borradores" />
            {counts.BLOCKED > 0 && <Tile value={counts.BLOCKED} label="Bloqueados" />}
          </ul>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-labelledby="publicaciones" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
              <h2 id="publicaciones" className="font-display text-[22px] font-bold">
                Publicaciones
              </h2>
              <ul className="flex flex-col gap-3.5">
                {spaces.map((space) => (
                  <OwnerSpaceRow key={space.id} space={space} pending={pending.has(space.id)} onToggle={toggle} />
                ))}
              </ul>
            </section>

            <section
              aria-labelledby="reservas"
              className="flex max-w-[420px] flex-[1_1_300px] flex-col gap-3.5 rounded-[18px] border border-line bg-white p-5"
            >
              <h2 id="reservas" className="font-display text-[22px] font-bold">
                Próximas reservas
              </h2>
              {/* Las reservas son de otro módulo (RE-02 a RE-04); cuando existan, se listan aquí. */}
              <p className="text-sm leading-relaxed text-muted">
                Todavía no hay reservas para mostrar. Cuando se habilite la reserva en línea, las próximas de tus espacios
                aparecerán aquí.
              </p>
            </section>
          </div>
        </>
      )}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="¿Desactivar este espacio?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button loading={confirming !== null && pending.has(confirming.id)} onClick={() => void confirmDeactivation()}>
              Desactivar
            </Button>
          </>
        }
      >
        «{confirming?.name}» saldrá del catálogo y no recibirá nuevas reservas. Las reservas ya confirmadas se mantienen. Puedes
        volver a activarlo cuando quieras.
      </Modal>
    </div>
  )
}

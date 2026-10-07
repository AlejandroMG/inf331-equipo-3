import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Modal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { useToast } from '../../components/toast-context'
import { cn } from '../../lib/cn'
import { useRequest } from '../../lib/useRequest'
import { AdminNav } from './AdminNav'
import { blockSpace, fetchAdminSpaces, unblockSpace, type AdminSpaceFilters } from './moderation-api'
import { MAX_REASON, MIN_REASON, type AdminSpace } from './types'

const STATUS: Record<AdminSpace['status'], { label: string; badge: string }> = {
  ACTIVE: { label: 'Activo', badge: 'bg-primary-soft text-primary-dark' },
  INACTIVE: { label: 'Inactivo', badge: 'border border-line bg-surface text-muted' },
  DRAFT: { label: 'Borrador', badge: 'bg-accent-soft text-accent-ink' },
  BLOCKED: { label: 'Bloqueado', badge: 'bg-accent text-white' },
}
const STATUS_OPTIONS = (Object.keys(STATUS) as AdminSpace['status'][]).map((status) => ({ value: status, label: STATUS[status].label }))

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

function parseFilters(params: URLSearchParams): AdminSpaceFilters {
  const status = params.get('status')
  return {
    status: STATUS_OPTIONS.find((option) => option.value === status)?.value ?? null,
    q: (params.get('q') ?? '').trim().slice(0, 100),
  }
}

function toSearchParams(filters: AdminSpaceFilters, page = 1): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  if (page > 1) params.set('page', String(page))
  return params
}

/** El buscador por texto: se aplica al enviar. Quien lo usa le pone `key={value}` para que siga a la URL. */
function SearchForm({ value, onSearch }: { value: string; onSearch: (text: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(text.trim())
      }}
      className="flex min-w-60 flex-[2_1_280px] items-end gap-2"
    >
      <div className="flex-1">
        <Input label="Buscar" value={text} maxLength={100} onChange={(event) => setText(event.target.value)} placeholder="Espacio o propietario" />
      </div>
      <Button type="submit" className="mb-px">
        Buscar
      </Button>
    </form>
  )
}

/** Moderación de espacios (AD-02): todos los espacios, con su propietario; despublicar con un motivo y desbloquear. */
export function AdminSpacesPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const filters = parseFilters(searchParams)
  const { data, error, loading, retry } = useRequest(toSearchParams(filters, page).toString(), (signal) => fetchAdminSpaces({ page, filters, signal }))
  // Lo que devolvió el servidor al bloquear o desbloquear; tapa la fila de la lista cargada sin volver a pedirla.
  const [updated, setUpdated] = useState<Record<string, AdminSpace>>({})
  const [blocking, setBlocking] = useState<AdminSpace | null>(null)
  const [unblocking, setUnblocking] = useState<AdminSpace | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  const spaces = data?.items.map((space) => updated[space.id] ?? space)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const apply = (changes: Partial<AdminSpaceFilters>) => setSearchParams(toSearchParams({ ...filters, ...changes }))

  function openBlock(space: AdminSpace) {
    setReason('')
    setReasonError(undefined)
    setBlocking(space)
  }

  async function confirmBlock() {
    if (!blocking) return
    const text = reason.trim()
    if (text.length < MIN_REASON || text.length > MAX_REASON) {
      setReasonError(`Escribe un motivo de ${MIN_REASON} a ${MAX_REASON} caracteres.`)
      return
    }
    setPending(true)
    try {
      const result = await blockSpace(blocking.id, text)
      setUpdated((current) => ({ ...current, [result.id]: result }))
      toast.show(`«${blocking.name}» quedó bloqueado y salió del catálogo.`)
      setBlocking(null)
    } catch (failure) {
      setReasonError(failure instanceof Error ? failure.message : 'No pudimos bloquear el espacio. Intenta de nuevo.')
    } finally {
      setPending(false)
    }
  }

  async function confirmUnblock() {
    if (!unblocking) return
    setPending(true)
    try {
      const result = await unblockSpace(unblocking.id)
      setUpdated((current) => ({ ...current, [result.id]: result }))
      toast.show(`«${unblocking.name}» ya no está bloqueado: su propietario puede activarlo.`)
      setUnblocking(null)
    } catch (failure) {
      toast.show(failure instanceof Error ? failure.message : 'No pudimos desbloquear el espacio. Intenta de nuevo.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Administración de espacios</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">
        Todos los espacios de la plataforma. Un espacio bloqueado sale del catálogo y su propietario ve el motivo.
      </p>
      <AdminNav />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <SearchForm key={filters.q} value={filters.q} onSearch={(q) => apply({ q })} />
        <div className="min-w-48 flex-1 sm:max-w-56">
          <Select
            label="Estado"
            value={filters.status ?? ''}
            placeholder="Todos"
            options={STATUS_OPTIONS}
            onChange={(event) => apply({ status: (event.target.value || null) as AdminSpace['status'] | null })}
          />
        </div>
      </div>

      {loading && (
        <p role="status" aria-label="Cargando espacios" className="text-muted">
          Cargando espacios…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar los espacios.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {spaces && spaces.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
          <h2 className="font-display text-xl font-bold">No hay espacios con esos filtros</h2>
        </div>
      )}

      {spaces && spaces.length > 0 && (
        <>
          <p className="mb-3 text-[15px] text-muted" aria-live="polite">
            {data!.total === 1 ? '1 espacio' : `${data!.total} espacios`}
          </p>
          <ul className="flex flex-col gap-3.5">
            {spaces.map((space) => (
              <li key={space.id} className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-white p-4">
                <div className="min-w-0 flex-[1_1_260px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold">{space.name}</h2>
                    <span className={cn('rounded-full px-2.5 py-[3px] text-[13px] font-bold', STATUS[space.status].badge)}>{STATUS[space.status].label}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[space.typeName, space.communeName].filter(Boolean).join(' · ') || 'Sin tipo ni comuna'}
                  </p>
                  <p className="text-sm text-muted">
                    {space.ownerName} · {space.ownerEmail}
                  </p>
                  {space.blockedReason && <p className="mt-1.5 text-sm font-semibold text-accent-ink">Motivo: {space.blockedReason}</p>}
                </div>
                {(space.status === 'ACTIVE' || space.status === 'INACTIVE') && (
                  <Button variant="secondary" size="sm" onClick={() => openBlock(space)} aria-label={`Bloquear ${space.name}`}>
                    Bloquear
                  </Button>
                )}
                {space.status === 'BLOCKED' && (
                  <Button variant="secondary" size="sm" onClick={() => setUnblocking(space)} aria-label={`Desbloquear ${space.name}`}>
                    Desbloquear
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {data && (
        <div className="mt-10">
          <Pagination page={data.page} totalPages={totalPages} hrefFor={(n) => `?${toSearchParams(filters, n)}`} />
        </div>
      )}

      <Modal
        open={blocking !== null}
        onClose={() => setBlocking(null)}
        title="¿Bloquear este espacio?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlocking(null)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={() => void confirmBlock()}>
              Bloquear
            </Button>
          </>
        }
      >
        <p className="mb-4">
          «{blocking?.name}» saldrá del catálogo y su propietario no podrá activarlo. Las reservas ya confirmadas se mantienen.
        </p>
        <Textarea
          label="Motivo"
          value={reason}
          maxLength={MAX_REASON}
          onChange={(event) => {
            setReason(event.target.value)
            setReasonError(undefined)
          }}
          error={reasonError}
          hint={`Lo verá el propietario. De ${MIN_REASON} a ${MAX_REASON} caracteres.`}
        />
      </Modal>

      <Modal
        open={unblocking !== null}
        onClose={() => setUnblocking(null)}
        title="¿Desbloquear este espacio?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnblocking(null)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={() => void confirmUnblock()}>
              Desbloquear
            </Button>
          </>
        }
      >
        «{unblocking?.name}» quedará desactivado: su propietario decide cuándo volver a activarlo.
      </Modal>
    </div>
  )
}

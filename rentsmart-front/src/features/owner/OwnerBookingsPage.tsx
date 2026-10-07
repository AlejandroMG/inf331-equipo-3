import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Pagination } from '../../components/Pagination'
import { Select } from '../../components/Select'
import { useRequest } from '../../lib/useRequest'
import { BookingCard } from './BookingCard'
import { DATE_PATTERN, STATUS_LABELS } from './booking-format'
import { fetchOwnerBookings, type BookingFilters } from './owner-api'
import { OwnerNav } from './OwnerNav'
import type { BookingStatus } from './types'

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as BookingStatus[]).map((status) => ({ value: status, label: STATUS_LABELS[status] }))
const SORT_OPTIONS = [
  { value: 'desc', label: 'Más lejanas primero' },
  { value: 'asc', label: 'Más próximas primero' },
]

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Los filtros de la URL; lo que no se entiende se ignora. */
function parseFilters(params: URLSearchParams): BookingFilters {
  const status = params.get('status')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  return {
    status: STATUS_OPTIONS.find((option) => option.value === status)?.value as BookingStatus | undefined ?? null,
    from: DATE_PATTERN.test(from) ? from : '',
    to: DATE_PATTERN.test(to) ? to : '',
    sort: params.get('sort') === 'asc' ? 'asc' : 'desc',
  }
}

function toSearchParams(filters: BookingFilters, page = 1): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.sort === 'asc') params.set('sort', 'asc')
  if (page > 1) params.set('page', String(page))
  return params
}

/** Reservas de mis espacios (PN-02), por estado y fecha. Los filtros viven en la URL. */
export function OwnerBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const filters = parseFilters(searchParams)
  const filtered = filters.status !== null || filters.from !== '' || filters.to !== ''
  const { data, error, loading, retry } = useRequest(toSearchParams(filters, page).toString(), (signal) =>
    fetchOwnerBookings({ page, filters, signal }),
  )
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  // Cambiar un filtro vuelve a la primera página: la actual podría no existir con el nuevo resultado.
  const apply = (changes: Partial<BookingFilters>) => setSearchParams(toSearchParams({ ...filters, ...changes }))

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Reservas de mis espacios</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">Revisa quién reservó, cuándo y cuánto recibes. Los horarios están en hora de Chile.</p>
      <OwnerNav />

      <form onSubmit={(event) => event.preventDefault()} aria-label="Filtros de reservas" className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1 sm:max-w-56">
          <Select
            label="Estado"
            value={filters.status ?? ''}
            placeholder="Todos"
            options={STATUS_OPTIONS}
            onChange={(event) => apply({ status: (event.target.value || null) as BookingStatus | null })}
          />
        </div>
        <div className="min-w-44 flex-1 sm:max-w-48">
          <Input label="Desde" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => apply({ from: event.target.value })} />
        </div>
        <div className="min-w-44 flex-1 sm:max-w-48">
          <Input label="Hasta" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => apply({ to: event.target.value })} />
        </div>
        <div className="min-w-48 flex-1 sm:max-w-56">
          <Select label="Orden" value={filters.sort} options={SORT_OPTIONS} onChange={(event) => apply({ sort: event.target.value as 'asc' | 'desc' })} />
        </div>
        {filtered && (
          <Button variant="secondary" onClick={() => setSearchParams(toSearchParams({ ...filters, status: null, from: '', to: '' }))}>
            Limpiar filtros
          </Button>
        )}
      </form>

      {loading && (
        <p role="status" aria-label="Cargando reservas" className="text-muted">
          Cargando tus reservas…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tus reservas.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
          {filtered ? (
            <>
              <h2 className="font-display text-xl font-bold">No hay reservas con esos filtros</h2>
              <p className="mt-2 text-muted">Prueba con otro estado u otras fechas.</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold">Todavía no tienes reservas</h2>
              <p className="mt-2 text-muted">Cuando alguien reserve uno de tus espacios, aparecerá aquí.</p>
            </>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="mb-3 text-[15px] text-muted" aria-live="polite">
            {data.total === 1 ? '1 reserva' : `${data.total} reservas`}
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {data.items.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </ul>
        </>
      )}

      {data && (
        <div className="mt-10">
          <Pagination page={data.page} totalPages={totalPages} hrefFor={(n) => `?${toSearchParams(filters, n)}`} />
        </div>
      )}
    </div>
  )
}

import { Link, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { formatClp } from '../../lib/format'
import { useRequest } from '../../lib/useRequest'
import { currentMonthInSantiago, formatHours, formatPercent, MONTH_PATTERN, monthLabel, shiftMonth } from './booking-format'
import { fetchOwnerMetrics } from './owner-api'
import { OwnerNav } from './OwnerNav'
import type { SpaceMetrics } from './types'

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-card border border-line bg-white px-4 py-4 sm:px-5 sm:py-[18px]">
      <div className="font-display text-2xl font-bold leading-tight sm:text-[32px]">{value}</div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
    </li>
  )
}

function SpaceRow({ space }: { space: SpaceMetrics }) {
  const percent = space.occupancy === null ? null : Math.round(space.occupancy * 100)
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{space.name}</h3>
        <p className="text-[15px]">
          <span className="font-bold">{formatClp(space.income)}</span>{' '}
          <span className="text-muted">· {space.bookings === 1 ? '1 reserva' : `${space.bookings} reservas`}</span>
        </p>
      </div>
      {space.occupancy === null ? (
        <p className="text-[15px] text-muted">Sin horario cargado: no se puede calcular la ocupación.</p>
      ) : (
        <>
          <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[15px]">
            <span className="font-semibold">Ocupación {formatPercent(space.occupancy)}</span>{' '}
            <span className="text-muted">
              · {formatHours(space.bookedHours)} de {formatHours(space.availableHours)} horas arrendables
            </span>
          </p>
        </>
      )}
    </li>
  )
}

/** Métricas del propietario (PN-04): ingresos del mes y ocupación de cada espacio. El mes vive en la URL. */
export function OwnerMetricsPage() {
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('month') ?? ''
  const current = currentMonthInSantiago()
  const month = MONTH_PATTERN.test(requested) ? requested : current
  const { data, error, loading, retry } = useRequest(`owner-metrics:${month}`, (signal) => fetchOwnerMetrics(month, signal))

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Métricas</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">
        Ingresos y ocupación de tus espacios. Cuentan las reservas confirmadas y finalizadas que empiezan en el mes.
      </p>
      <OwnerNav />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to={`?month=${shiftMonth(month, -1)}`}
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-[15px] font-semibold text-ink no-underline hover:bg-surface"
        >
          Mes anterior
        </Link>
        <h2 className="min-w-44 text-center font-display text-xl font-bold first-letter:uppercase" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <Link
          to={`?month=${shiftMonth(month, 1)}`}
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-[15px] font-semibold text-ink no-underline hover:bg-surface"
        >
          Mes siguiente
        </Link>
        {month !== current && (
          <Link to="?" className="inline-flex min-h-11 items-center px-2 text-[15px] font-semibold text-primary underline">
            Ir al mes actual
          </Link>
        )}
      </div>

      {loading && (
        <p role="status" aria-label="Cargando métricas" className="text-muted">
          Cargando tus métricas…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tus métricas.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {data && (
        <>
          <ul aria-label="Resumen del mes" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:max-w-xl">
            <Tile value={formatClp(data.income)} label="Ingresos del mes" />
            <Tile value={String(data.bookings)} label={data.bookings === 1 ? 'Reserva' : 'Reservas'} />
          </ul>

          {data.spaces.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
              <h2 className="font-display text-xl font-bold">Todavía no tienes espacios publicados</h2>
              <p className="mt-2 text-muted">Cuando publiques uno, aquí verás sus ingresos y su ocupación.</p>
            </div>
          ) : (
            <section aria-labelledby="por-espacio" className="flex flex-col gap-3.5">
              <h2 id="por-espacio" className="font-display text-[22px] font-bold">
                Por espacio
              </h2>
              <ul className="flex flex-col gap-3.5">
                {data.spaces.map((space) => (
                  <SpaceRow key={space.id} space={space} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

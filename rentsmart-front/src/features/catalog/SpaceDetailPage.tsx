import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { LinkButton, Button } from '../../components/Button'
import { ApiError } from '../../lib/http'
import { formatClp } from '../../lib/format'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { FavoriteButton } from '../favorites/FavoriteButton'
import { BookingSlot } from './BookingSlot'
import { Gallery } from './Gallery'
import { groupSchedule } from './schedule'
import { useSpace } from './useSpace'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Cargando el espacio" className="flex flex-col gap-6">
      <div className="h-9 w-2/3 motion-safe:animate-pulse rounded bg-line/60" />
      <div className="h-60 motion-safe:animate-pulse rounded-[18px] bg-line/60 sm:h-[440px]" />
      <div className="h-4 w-1/2 motion-safe:animate-pulse rounded bg-line/60" />
    </div>
  )
}

export function SpaceDetailPage() {
  const { spaceId = '' } = useParams()
  const { data: space, error, loading, retry } = useSpace(spaceId)
  usePageTitle(space?.name ?? (error instanceof ApiError && error.status === 404 ? 'Espacio no disponible' : undefined))

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      {loading && <DetailSkeleton />}

      {error instanceof ApiError && error.status === 404 && (
        <div className="flex flex-col items-start gap-4 py-10">
          <h1 className="font-display text-3xl font-bold">Este espacio no está disponible</h1>
          <p className="max-w-lg text-muted">No existe o su publicación se desactivó. Mira otros espacios del catálogo.</p>
          <LinkButton to={paths.home}>Ver el catálogo</LinkButton>
        </div>
      )}

      {error && !(error instanceof ApiError && error.status === 404) && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar el espacio.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {space && (
        <>
          <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            <Link to={paths.home} className="inline-flex min-h-11 items-center font-semibold text-primary">
              Catálogo
            </Link>
            <span aria-hidden="true"> / </span>
            <span>{space.typeName}</span>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{space.name}</span>
          </nav>

          <div className="mb-5 mt-4">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-[42px]">{space.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[15px] text-muted">
              <span>{space.typeName}</span>
              <span>{space.communeName}</span>
              <span>Hasta {space.capacity} personas</span>
              {/* Mientras no existan reseñas (RS-02), todos los espacios son "Nuevo". */}
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-bold text-accent-ink">
                Nuevo · sin reseñas aún
              </span>
            </p>
            <FavoriteButton spaceId={space.id} name={space.name} variant="text" className="mt-4" />
          </div>

          <Gallery photos={space.photos} name={space.name} />

          <div className="mt-8 flex flex-wrap items-start gap-8">
            <div className="flex min-w-0 flex-[999_1_540px] flex-col gap-9">
              {space.description && (
                <Section title="Sobre este espacio">
                  <p className="max-w-[680px] whitespace-pre-line text-base leading-relaxed">{space.description}</p>
                </Section>
              )}

              {space.amenities.length > 0 && (
                <Section title="Qué incluye">
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {space.amenities.map((amenity) => (
                      <li key={amenity} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-[15px]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                        {amenity}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {space.rules && (
                <Section title="Reglas del espacio">
                  <p className="max-w-[680px] whitespace-pre-line text-base leading-relaxed">{space.rules}</p>
                </Section>
              )}

              {space.schedule.length > 0 && (
                <Section title="Horario de atención">
                  <table className="w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-white text-[15px]">
                    <caption className="sr-only">Horario semanal</caption>
                    <tbody>
                      {groupSchedule(space.schedule).map((row) => (
                        <tr key={row.days} className="border-b border-line last:border-b-0">
                          <th scope="row" className="px-3.5 py-2.5 text-left font-semibold">
                            {row.days}
                          </th>
                          <td className={row.hours ? 'px-3.5 py-2.5' : 'px-3.5 py-2.5 text-muted'}>{row.hours ?? 'No disponible'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              <Section title="Ubicación">
                <p className="text-base">
                  {[space.address, space.communeName, space.regionName].filter(Boolean).join(', ')}
                </p>
                <p className="mt-3 flex items-start gap-2 text-sm text-muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  El detalle de la dirección (piso, oficina e indicaciones) se muestra cuando tu reserva esté confirmada.
                </p>
              </Section>

              <Section title="Reseñas">
                <div className="rounded-card border border-dashed border-line bg-white p-6 text-[15px] text-muted">
                  Este espacio aún no tiene reseñas. Aparecerán aquí después de las primeras reservas finalizadas.
                </div>
              </Section>
            </div>

            <aside aria-label="Reservar" className="box-border flex max-w-[420px] flex-[1_1_340px] flex-col gap-3.5 rounded-[18px] border border-line bg-white p-5 shadow-[0_8px_24px_rgba(16,32,30,0.08)] lg:sticky lg:top-4">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                {space.pricePerHour !== null && (
                  <>
                    <span className="text-[28px] font-bold">{formatClp(space.pricePerHour)}</span>
                    <span className="text-muted">/ hora</span>
                  </>
                )}
                {space.pricePerDay !== null && (
                  <span className="text-muted">
                    {space.pricePerHour !== null ? 'o ' : ''}
                    <span className={space.pricePerHour === null ? 'text-[28px] font-bold text-ink' : ''}>
                      {formatClp(space.pricePerDay)}
                    </span>{' '}
                    / día
                  </span>
                )}
              </div>
              <BookingSlot />
              <p className="text-sm leading-relaxed text-muted">
                Reserva inmediata: no necesitas esperar la aprobación del propietario. El horario queda retenido 30 minutos mientras pagas.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

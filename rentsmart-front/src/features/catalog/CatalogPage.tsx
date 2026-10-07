import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Pagination } from '../../components/Pagination'
import { usePageTitle } from '../../lib/page-title'
import { CATALOG_PAGE_SIZE } from './catalog-api'
import { FilterBar } from './FilterBar'
import { hasFilters, noFilters, parseFilters, toSearchParams, type CatalogFilters } from './filters'
import { SearchBox } from './SearchBox'
import { SortSelect } from './SortSelect'
import { SpaceCard } from './SpaceCard'
import { useCatalog, useFilterOptions } from './useCatalog'

// La página, los filtros y el orden viven en la URL (?typeId=8&sort=price_asc&page=2): se puede recargar, compartir y volver atrás.
function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card border border-line bg-white">
      <div className="h-44 motion-safe:animate-pulse bg-line/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/3 motion-safe:animate-pulse rounded bg-line/60" />
        <div className="h-5 w-3/4 motion-safe:animate-pulse rounded bg-line/60" />
        <div className="h-3 w-1/2 motion-safe:animate-pulse rounded bg-line/60" />
      </div>
    </div>
  )
}

export function CatalogPage() {
  usePageTitle('Espacios para arrendar')
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const filters = parseFilters(searchParams)
  const filtered = hasFilters(filters)
  const { data, error, loading, retry } = useCatalog(page, filters)
  const { data: options } = useFilterOptions()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  // Cambiar un filtro vuelve a la primera página: la actual podría no existir con el nuevo resultado.
  const applyFilters = (changes: Partial<CatalogFilters>) => setSearchParams(toSearchParams({ ...filters, ...changes }))
  // Limpiar los filtros deja el orden que se había elegido.
  const clearFilters = () => setSearchParams(toSearchParams({ ...noFilters, sort: filters.sort }))

  return (
    <>
      <section className="bg-primary text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-[18px] px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-14">
          <h1 className="max-w-[760px] font-display text-[30px] font-bold leading-[1.08] sm:text-5xl">
            Encuentra el espacio justo, por hora o por día
          </h1>
          <p className="max-w-[560px] text-lg leading-normal">
            Salas, estudios, cocinas y canchas de particulares en la Región Metropolitana. Reserva al instante, sin esperar
            aprobación.
          </p>
          <SearchBox key={filters.q} value={filters.q} onSearch={(q) => applyFilters({ q })} />
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <FilterBar options={options} filters={filters} onChange={applyFilters} onClear={clearFilters} />

        <div className="mb-4 mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-[26px] font-bold">Espacios disponibles</h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {data && (
              <p className="text-[15px] text-muted" aria-live="polite">
                {data.total === 1 ? '1 espacio' : `${data.total} espacios`}
              </p>
            )}
            <SortSelect value={filters.sort} priceUnit={filters.priceUnit} onChange={(sort) => applyFilters({ sort })} />
          </div>
        </div>

        {loading && (
          <div role="status" aria-label="Cargando espacios" className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-6">
            {Array.from({ length: CATALOG_PAGE_SIZE / 2 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
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

        {data && data.items.length === 0 && (
          <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
            {filtered ? (
              <>
                <h3 className="font-display text-xl font-bold">No encontramos espacios con esos filtros</h3>
                <p className="mt-2 text-muted">Prueba con otra comuna, un precio más alto o quita algún filtro.</p>
                <Button onClick={clearFilters} className="mt-6">
                  Limpiar filtros
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold">Todavía no hay espacios publicados</h3>
                <p className="mt-2 text-muted">Vuelve pronto o publica el tuyo.</p>
              </>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-6">
            {data.items.map((space) => (
              <li key={space.id} className="flex">
                <SpaceCard space={space} />
              </li>
            ))}
          </ul>
        )}

        {data && (
          <div className="mt-10">
            <Pagination page={data.page} totalPages={totalPages} hrefFor={(n) => `?${toSearchParams(filters, n)}`} />
          </div>
        )}
      </div>
    </>
  )
}

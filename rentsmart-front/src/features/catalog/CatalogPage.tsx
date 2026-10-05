import { useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Pagination } from '../../components/Pagination'
import { CATALOG_PAGE_SIZE } from './catalog-api'
import { SpaceCard } from './SpaceCard'
import { useCatalog } from './useCatalog'

// La página vive en la URL (?page=2): se puede recargar, compartir y volver atrás.
function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card border border-line bg-white">
      <div className="h-44 animate-pulse bg-line/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line/60" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-line/60" />
      </div>
    </div>
  )
}

export function CatalogPage() {
  const [searchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const { data, error, loading, retry } = useCatalog(page)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Espacios disponibles</h1>
        {data && (
          <p className="text-[15px] text-muted" aria-live="polite">
            {data.total === 1 ? '1 espacio' : `${data.total} espacios`}
          </p>
        )}
      </div>

      <div className="mt-6">
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
            <h2 className="font-display text-xl font-bold">Todavía no hay espacios publicados</h2>
            <p className="mt-2 text-muted">Vuelve pronto o publica el tuyo.</p>
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
      </div>

      {data && (
        <div className="mt-10">
          <Pagination page={data.page} totalPages={totalPages} hrefFor={(n) => `?page=${n}`} />
        </div>
      )}
    </div>
  )
}

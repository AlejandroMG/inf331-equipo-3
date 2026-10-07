import { useSearchParams } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { Pagination } from '../../components/Pagination'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { SpaceCard } from '../catalog/SpaceCard'
import { fetchFavorites } from './favorites-api'
import { useFavorites } from './favorites-context'

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Mis favoritos (BU-08): los espacios guardados que siguen activos, el último guardado primero. */
export function FavoritesPage() {
  const [searchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const { data, error, loading, retry } = useRequest(`favorites:${page}`, (signal) => fetchFavorites(page, signal))
  const favorites = useFavorites()

  // Quitar un favorito desde aquí lo saca de la lista al instante, sin volver a pedirla.
  const items = data?.items.filter((item) => !favorites.ready || favorites.isFavorite(item.id)) ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-[40px]">Mis favoritos</h1>
        {data && data.total > 0 && (
          <p className="text-[15px] text-muted" aria-live="polite">
            {data.total === 1 ? '1 espacio guardado' : `${data.total} espacios guardados`}
          </p>
        )}
      </div>

      {loading && (
        <p role="status" aria-label="Cargando favoritos" className="text-muted">
          Cargando tus favoritos…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tus favoritos.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {data && items.length === 0 && (
        <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
          {data.total === 0 ? (
            <>
              <h2 className="font-display text-xl font-bold">Todavía no tienes favoritos</h2>
              <p className="mt-2 text-muted">Toca el corazón de un espacio para guardarlo y encontrarlo aquí.</p>
              <LinkButton to={paths.home} className="mt-6">
                Explorar espacios
              </LinkButton>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold">Quitaste los favoritos de esta página</h2>
              <LinkButton to={paths.favorites} className="mt-6">
                Ver mis favoritos
              </LinkButton>
            </>
          )}
        </div>
      )}

      {data && items.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-6">
          {items.map((space) => (
            <li key={space.id} className="flex">
              <SpaceCard space={space} />
            </li>
          ))}
        </ul>
      )}

      {data && (
        <div className="mt-10">
          <Pagination page={data.page} totalPages={totalPages} hrefFor={(n) => `?page=${n}`} />
        </div>
      )}
    </div>
  )
}

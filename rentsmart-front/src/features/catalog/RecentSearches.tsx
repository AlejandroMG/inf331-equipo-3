import { Link } from 'react-router'
import { cn } from '../../lib/cn'
import { parseFilters } from './filters'
import { describeSearch, type RecentSearch } from './search-history'

interface RecentSearchesProps {
  entries: RecentSearch[]
  /** La búsqueda que está en pantalla (su clave); se marca como la actual. */
  currentKey: string
  options?: { types: { id: number; name: string }[]; communes: { id: number; name: string }[] }
  onClear: () => void
}

/**
 * Búsquedas recientes (BU-07): un botón por cada una, que la repite, y uno para borrar el historial. Cada una es un
 * enlace a la URL de la búsqueda, así que también se puede abrir en otra pestaña. Sin historial no se muestra.
 */
export function RecentSearches({ entries, currentKey, options, onClear }: RecentSearchesProps) {
  if (entries.length === 0) return null

  return (
    <nav aria-label="Búsquedas recientes" className="flex max-w-[860px] flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-semibold">Búsquedas recientes:</span>
      <ul className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const current = entry.params === currentKey
          return (
            <li key={entry.params}>
              <Link
                to={`/?${entry.params}`}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold no-underline',
                  current ? 'border-white bg-white text-primary-dark' : 'border-white/60 text-white hover:bg-white/15',
                )}
              >
                {describeSearch(parseFilters(new URLSearchParams(entry.params)), options)}
              </Link>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onClear} className="min-h-11 px-2 text-[15px] font-semibold text-white underline">
        Borrar historial
      </button>
    </nav>
  )
}

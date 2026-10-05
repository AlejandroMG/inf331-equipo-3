import { Link } from 'react-router'
import { cn } from '../lib/cn'
import { pageItems } from '../lib/pagination'

interface PaginationProps {
  page: number
  totalPages: number
  /** Dirección de una página, por ejemplo "?page=2"; son enlaces reales para poder abrirlos en otra pestaña. */
  hrefFor: (page: number) => string
}

const base = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-4 font-semibold no-underline'

export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginación" className="flex flex-wrap justify-center gap-2">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} className={cn(base, 'border border-line bg-white text-ink')}>
          Anterior
        </Link>
      ) : (
        <span className={cn(base, 'border border-line bg-white text-muted')}>Anterior</span>
      )}
      {pageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="inline-flex min-h-11 items-center px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={item}
            to={hrefFor(item)}
            aria-label={`Página ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cn(base, 'px-0', item === page ? 'bg-primary text-white' : 'border border-line bg-white text-ink')}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} className={cn(base, 'border border-line bg-white text-ink')}>
          Siguiente
        </Link>
      ) : (
        <span className={cn(base, 'border border-line bg-white text-muted')}>Siguiente</span>
      )}
    </nav>
  )
}

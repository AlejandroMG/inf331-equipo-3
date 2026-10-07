import { Link } from 'react-router'
import { formatClp } from '../../lib/format'
import { paths } from '../../lib/paths'
import { FavoriteButton } from '../favorites/FavoriteButton'
import type { CatalogItem } from './types'

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  )
}

function ImagePlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-55">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" />
    </svg>
  )
}

/** Tarjeta de un espacio en el catálogo; toda la tarjeta lleva al detalle, salvo el corazón de favoritos (BU-08). */
export function SpaceCard({ space }: { space: CatalogItem }) {
  return (
    // El corazón es un botón y no puede ir dentro del enlace: va al lado, encima de la foto.
    <div className="relative flex w-full">
      <Link
        to={paths.space(space.id)}
        className="flex w-full flex-col overflow-hidden rounded-card border border-line bg-white text-ink no-underline"
      >
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-primary-soft to-accent-soft text-primary">
          {space.coverUrl ? (
            <img src={space.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <ImagePlaceholder />
          )}
          {/* Mientras no existan reseñas (RS-02), todos los espacios son "Nuevo". */}
          <span className="absolute left-3 top-3 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-bold text-accent-ink">
            Nuevo
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">{space.typeName}</span>
          <h3 className="font-display text-[19px] font-bold leading-tight">{space.name}</h3>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon />
              {space.communeName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon />
              Hasta {space.capacity} personas
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
            {space.pricePerHour !== null && (
              <>
                <span className="text-xl font-bold">{formatClp(space.pricePerHour)}</span>
                <span className="text-sm text-muted">/ hora</span>
              </>
            )}
            {space.pricePerDay !== null && (
              <span className="text-sm text-muted">
                {space.pricePerHour !== null ? 'o ' : ''}
                <span className={space.pricePerHour === null ? 'text-xl font-bold text-ink' : ''}>
                  {formatClp(space.pricePerDay)}
                </span>{' '}
                / día
              </span>
            )}
          </div>
        </div>
      </Link>
      <FavoriteButton spaceId={space.id} name={space.name} className="absolute right-3 top-3" />
    </div>
  )
}

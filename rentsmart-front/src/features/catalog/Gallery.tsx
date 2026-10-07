import { useState } from 'react'
import { cn } from '../../lib/cn'
import type { SpacePhoto } from './types'

function ImagePlaceholder() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="opacity-50">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" />
    </svg>
  )
}

interface GalleryProps {
  photos: SpacePhoto[]
  /** Nombre del espacio, para describir las fotos. */
  name: string
}

/** Foto principal con miniaturas para cambiarla. Sin fotos muestra un marcador. */
export function Gallery({ photos, name }: GalleryProps) {
  const [selected, setSelected] = useState(0)
  const current = photos[selected]

  return (
    <section aria-label="Galería de fotos">
      <div className="relative flex h-60 items-center justify-center overflow-hidden rounded-[18px] bg-gradient-to-br from-primary-soft to-accent-soft text-primary sm:h-[440px]">
        {current ? (
          <img src={current.url} alt={`${name}, foto ${selected + 1} de ${photos.length}`} className="size-full object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
        {current && (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink">
            Foto {selected + 1} de {photos.length}
            {selected === 0 ? ' · portada' : ''}
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Ver foto ${index + 1}`}
              aria-pressed={index === selected}
              className={cn(
                'h-16 w-[92px] shrink-0 overflow-hidden rounded-xl bg-primary-soft p-0',
                index === selected ? 'border-[3px] border-primary' : 'border border-line',
              )}
            >
              <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

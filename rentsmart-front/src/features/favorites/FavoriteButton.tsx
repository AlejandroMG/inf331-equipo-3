import { useLocation, useNavigate } from 'react-router'
import { cn } from '../../lib/cn'
import { paths } from '../../lib/paths'
import { useToken } from '../../lib/token'
import { useFavorites } from './favorites-context'

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5s-8-4.7-8-10.6A4.6 4.6 0 0 1 8.6 5.3c1.3 0 2.5.6 3.4 1.7.9-1.1 2.1-1.7 3.4-1.7A4.6 4.6 0 0 1 20 9.9c0 5.9-8 10.6-8 10.6Z" />
    </svg>
  )
}

interface FavoriteButtonProps {
  spaceId: string
  /** El nombre del espacio: el botón de ícono lo necesita para decir de cuál se trata. */
  name: string
  /** `icon` es el corazón de las tarjetas; `text` lleva escrito "Guardar en favoritos" (detalle del espacio). */
  variant?: 'icon' | 'text'
  className?: string
}

/**
 * Corazón para guardar un espacio en favoritos (BU-08). Es un botón de dos estados (`aria-pressed`) y su nombre no
 * cambia al activarse. Sin sesión lleva a iniciarla y, al volver, regresa a esta pantalla.
 */
export function FavoriteButton({ spaceId, name, variant = 'icon', className }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites()
  const loggedIn = useToken() !== null
  const navigate = useNavigate()
  const location = useLocation()
  const active = loggedIn && isFavorite(spaceId)

  function onClick() {
    if (!loggedIn) {
      navigate(paths.login, { state: { from: location.pathname + location.search } })
      return
    }
    void toggle(spaceId)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={variant === 'icon' ? `Guardar en favoritos: ${name}` : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 text-accent-ink',
        variant === 'icon'
          ? 'size-11 rounded-full border border-field bg-white/95 shadow-sm hover:bg-white'
          : 'min-h-11 rounded-xl border border-field bg-white px-4 text-[15px] font-semibold text-ink hover:bg-surface',
        className,
      )}
    >
      <HeartIcon filled={active} />
      {variant === 'text' && 'Guardar en favoritos'}
    </button>
  )
}

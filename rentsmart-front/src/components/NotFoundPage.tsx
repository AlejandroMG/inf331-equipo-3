import { paths } from '../lib/paths'
import { LinkButton } from './Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Error 404</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">No encontramos esta página</h1>
      <p className="max-w-lg text-muted">La dirección no existe o ya no está disponible. Vuelve al inicio para seguir explorando.</p>
      <LinkButton to={paths.home}>Ir al inicio</LinkButton>
    </div>
  )
}

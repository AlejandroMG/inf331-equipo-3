import { Outlet } from 'react-router'
import { paths } from '../lib/paths'
import { useRole } from '../lib/role'
import { LinkButton } from './Button'

/**
 * Protege las pantallas de administración. Va dentro de <RequireAuth />, así que ya hay sesión; si el rol no es de
 * administrador, avisa en vez de mostrar una pantalla que no va a poder usar. La API vuelve a comprobarlo (403).
 */
export function RequireAdmin() {
  if (useRole() !== 'ADMIN') {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-bold">No tienes permiso para ver esto</h1>
        <p className="max-w-lg text-muted">Esta sección es solo para administradores.</p>
        <LinkButton to={paths.home}>Volver al catálogo</LinkButton>
      </div>
    )
  }
  return <Outlet />
}

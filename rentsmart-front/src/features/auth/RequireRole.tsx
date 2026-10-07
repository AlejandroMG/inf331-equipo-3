import { Navigate, Outlet, useLocation } from 'react-router'
import { LinkButton } from '../../components/Button'
import { paths } from '../../lib/paths'
import type { PublicUser } from './api'
import { useCurrentUser } from './useCurrentUser'

/**
 * Protege rutas que solo puede ver un rol (por ejemplo, el panel admin).
 * Sin sesión redirige a /login como RequireAuth; con otro rol muestra un aviso en vez de la pantalla.
 * La API igual valida el rol: esto solo evita mostrar pantallas que no servirían.
 */
export function RequireRole({ role }: { role: PublicUser['role'] }) {
  const location = useLocation()
  const { user, loading } = useCurrentUser()

  if (loading) {
    return <p className="mx-auto max-w-[1200px] px-4 py-10 text-muted sm:px-6">Cargando…</p>
  }
  if (!user) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname + location.search }} />
  }
  if (user.role !== role) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">Error 403</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">No tienes acceso a esta página</h1>
        <p className="max-w-lg text-muted">Esta sección es solo para administradores.</p>
        <LinkButton to={paths.home}>Ir al inicio</LinkButton>
      </div>
    )
  }
  return <Outlet />
}

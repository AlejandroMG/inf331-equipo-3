import { Navigate, Outlet, useLocation } from 'react-router'
import { getToken } from '../lib/token'
import { paths } from '../lib/paths'

/**
 * Protege las rutas privadas: sin token redirige a /login y guarda la ruta pedida en `state.from`
 * para volver a ella después de iniciar sesión.
 */
export function RequireAuth() {
  const location = useLocation()

  if (!getToken()) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

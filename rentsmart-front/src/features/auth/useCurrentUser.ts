import { useEffect, useState } from 'react'
import { useToken } from '../../lib/token'
import { me, type PublicUser } from './api'

export interface CurrentUserState {
  /** Usuario de la sesión, o null si no hay sesión (o el token ya no es válido). */
  user: PublicUser | null
  /** true mientras se consulta /auth/me para un token nuevo. */
  loading: boolean
}

/**
 * Usuario de la sesión actual, leído de GET /api/auth/me cada vez que cambia el token.
 * Si el token expiró, el cliente HTTP recibe un 401 y borra el token, así que la sesión se cierra sola.
 */
export function useCurrentUser(): CurrentUserState {
  const token = useToken()
  // Se guarda junto al token que lo produjo, para no mostrar el usuario de una sesión anterior.
  const [result, setResult] = useState<{ token: string; user: PublicUser | null } | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    me()
      .then((user) => !cancelled && setResult({ token, user }))
      .catch(() => !cancelled && setResult({ token, user: null }))
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return { user: null, loading: false }
  if (result?.token !== token) return { user: null, loading: true }
  return { user: result.user, loading: false }
}

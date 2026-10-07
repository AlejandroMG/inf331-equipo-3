import { useToken } from './token'

export type Role = 'USER' | 'ADMIN'

/**
 * El rol que dice el token de sesión (el campo `role` de su contenido). Sirve solo para mostrar u ocultar enlaces y
 * pantallas: el token se puede leer pero no confiar en él en el navegador, y quien decide qué se puede hacer es la API.
 * Devuelve `null` sin token o si no se entiende.
 */
export function roleFromToken(token: string | null): Role | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    // El contenido del JWT va en base64url: se pasa a base64 normal antes de decodificarlo.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const { role } = JSON.parse(new TextDecoder().decode(bytes)) as { role?: unknown }
    return role === 'ADMIN' || role === 'USER' ? role : null
  } catch {
    return null
  }
}

/** El rol de quien tiene la sesión abierta; se actualiza al iniciar o cerrar sesión. */
export function useRole(): Role | null {
  return roleFromToken(useToken())
}

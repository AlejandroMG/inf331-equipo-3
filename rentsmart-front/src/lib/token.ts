import { useSyncExternalStore } from 'react'

const TOKEN_KEY = 'rentsmart_token'

// Quienes muestran algo distinto con o sin sesión (el Navbar) se suscriben a los cambios del token.
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

// localStorage puede fallar (modo privado, datos bloqueados): la app debe seguir funcionando sin sesión.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Sin almacenamiento no hay sesión persistente; se ignora.
  }
  notify()
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nada que limpiar.
  }
  notify()
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener)
  // Iniciar o cerrar sesión en otra pestaña también actualiza esta.
  const onStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Token actual; el componente se vuelve a renderizar cuando se inicia o se cierra sesión. */
export function useToken(): string | null {
  return useSyncExternalStore(subscribeToken, getToken, () => null)
}

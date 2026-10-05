const TOKEN_KEY = 'rentsmart_token'

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
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nada que limpiar.
  }
}

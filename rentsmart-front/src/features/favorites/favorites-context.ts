import { createContext, useContext } from 'react'

export interface FavoritesApi {
  /** Si ya se cargaron los favoritos de la sesión; antes de eso los corazones se ven vacíos. */
  ready: boolean
  isFavorite: (spaceId: string) => boolean
  /** Guarda o quita un favorito. Se ve al instante y se deshace, con un aviso, si el servidor lo rechaza. */
  toggle: (spaceId: string) => Promise<void>
}

/** Sin proveedor (por ejemplo, en la prueba de una tarjeta suelta) no hay favoritos: todo se ve como no guardado. */
const none: FavoritesApi = { ready: false, isFavorite: () => false, toggle: async () => undefined }

export const FavoritesContext = createContext<FavoritesApi>(none)

export function useFavorites(): FavoritesApi {
  return useContext(FavoritesContext)
}

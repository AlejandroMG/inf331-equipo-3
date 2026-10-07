import { useEffect } from 'react'

export const APP_NAME = 'RentSmart'

/** El título de la pestaña para una pantalla: "Mis espacios · RentSmart". Sin título, solo el nombre de la app. */
export const pageTitle = (title?: string) => (title ? `${title} · ${APP_NAME}` : APP_NAME)

/**
 * Pone el título de la pestaña de las pantallas cuyo título depende de los datos (el nombre del espacio, por
 * ejemplo). Es lo primero que anuncia un lector de pantalla al cambiar de página. Las pantallas con título fijo
 * lo declaran en su ruta (`handle.title`). Con `undefined` no hace nada: mientras carga queda el título de antes.
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = pageTitle(title)
  }, [title])
}

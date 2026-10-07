import { useRequest } from '../../lib/useRequest'
import { fetchSpace } from './catalog-api'

/** Carga el detalle público de un espacio. */
export function useSpace(id: string) {
  return useRequest(id, (signal) => fetchSpace(id, signal))
}

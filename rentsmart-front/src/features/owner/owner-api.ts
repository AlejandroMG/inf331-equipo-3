import { http } from '../../lib/http'
import type { OwnerSpaceSummary } from './types'

/** Los espacios del usuario, de cualquier estado, los modificados más recientemente primero. */
export const fetchMySpaces = (signal?: AbortSignal) => http.get<OwnerSpaceSummary[]>('/spaces/me', { signal })

import type { ScheduleRule } from '../catalog/types'
import { http } from '../../lib/http'
import type { Schedule } from './types'

/** El horario semanal de un espacio propio, también de un borrador (DI-01). */
export const fetchSchedule = (spaceId: string, signal?: AbortSignal) =>
  http.get<Schedule>(`/spaces/${encodeURIComponent(spaceId)}/schedule`, { signal })

/** Reemplaza el horario completo y lo devuelve ordenado por día y hora de inicio. */
export const saveSchedule = (spaceId: string, rules: ScheduleRule[]) =>
  http.put<Schedule>(`/spaces/${encodeURIComponent(spaceId)}/schedule`, { rules })

import { formatClp } from '../../lib/format'
import type { MissingField } from '../spaces/form'
import type { OwnerSpaceSummary } from './types'

type Status = OwnerSpaceSummary['status']

const SHORT_LABELS: Record<MissingField, string> = {
  type: 'tipo de espacio',
  description: 'descripción',
  capacity: 'capacidad',
  commune: 'comuna',
  price: 'precio',
  photos: 'foto',
  schedule: 'horario',
}

const listFormat = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' })

/** Lo que falta, en una frase corta: "foto, precio y horario". Ignora los códigos que no conoce. */
export function missingText(missing: readonly string[]): string {
  const labels = missing.filter((code): code is MissingField => Object.hasOwn(SHORT_LABELS, code)).map((code) => SHORT_LABELS[code])
  return listFormat.format(labels)
}

/** Los precios del espacio: "$12.000 / hora · $50.000 / día", o que todavía no tiene. */
export function priceText({ pricePerHour, pricePerDay }: Pick<OwnerSpaceSummary, 'pricePerHour' | 'pricePerDay'>): string {
  const parts: string[] = []
  if (pricePerHour !== null) parts.push(`${formatClp(pricePerHour)} / hora`)
  if (pricePerDay !== null) parts.push(`${formatClp(pricePerDay)} / día`)
  return parts.length > 0 ? parts.join(' · ') : 'Sin precio todavía'
}

/** Debajo del nombre: tipo, comuna y precio, según lo que el borrador ya tenga. */
export function metaText(space: OwnerSpaceSummary): string {
  return [space.typeName, space.communeName, priceText(space)].filter((part): part is string => Boolean(part)).join(' · ')
}

/** Cuántos espacios hay en cada estado. */
export function countByStatus(spaces: readonly Pick<OwnerSpaceSummary, 'status'>[]): Record<Status, number> {
  const counts: Record<Status, number> = { ACTIVE: 0, INACTIVE: 0, DRAFT: 0, BLOCKED: 0 }
  for (const space of spaces) counts[space.status] += 1
  return counts
}

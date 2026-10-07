/** Lo que puede faltar para que un espacio se publique (ES-04). */
export type MissingField =
  | 'type'
  | 'description'
  | 'capacity'
  | 'commune'
  | 'price'
  | 'photos'
  | 'schedule';

export interface PublishCheck {
  typeId: number | null;
  description: string | null;
  capacity: number | null;
  communeId: number | null;
  pricePerHour: number | null;
  pricePerDay: number | null;
  photoCount: number;
  /** Cantidad de reglas del horario semanal (AvailabilityRule). */
  scheduleCount: number;
}

/**
 * Qué le falta a un espacio para estar publicado, en el orden del formulario. Lista vacía = completo.
 * Son las mismas reglas para publicar un borrador, reactivar uno desactivado y para no dejar incompleto
 * uno que ya está publicado.
 */
export function missingFields(check: PublishCheck): MissingField[] {
  const missing: MissingField[] = [];
  if (check.typeId === null) missing.push('type');
  if ((check.description ?? '').trim() === '') missing.push('description');
  if (check.capacity === null || check.capacity < 1) missing.push('capacity');
  if (check.communeId === null) missing.push('commune');
  if (!(check.pricePerHour ?? 0) && !(check.pricePerDay ?? 0)) {
    missing.push('price');
  }
  if (check.photoCount < 1) missing.push('photos');
  if (check.scheduleCount < 1) missing.push('schedule');
  return missing;
}

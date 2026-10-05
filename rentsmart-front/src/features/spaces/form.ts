import type { OwnerSpace, SpaceForm, SpacePayload } from './types'

export const MAX_NAME = 100
export const MAX_CAPACITY = 1000
export const MAX_PRICE = 10_000_000

export const emptyForm: SpaceForm = {
  name: '',
  typeId: '',
  description: '',
  capacity: '',
  amenityIds: [],
  rules: '',
  communeId: '',
  address: '',
  addressDetail: '',
  pricePerHour: '',
  pricePerDay: '',
}

const text = (value: string | null) => value ?? ''
const num = (value: number | null) => (value === null ? '' : String(value))

/** Pasa un espacio guardado en el servidor a los datos del formulario. */
export function toForm(space: OwnerSpace): SpaceForm {
  return {
    name: space.name,
    typeId: num(space.typeId),
    description: text(space.description),
    capacity: num(space.capacity),
    amenityIds: space.amenityIds,
    rules: text(space.rules),
    communeId: num(space.communeId),
    address: text(space.address),
    addressDetail: text(space.addressDetail),
    pricePerHour: num(space.pricePerHour),
    pricePerDay: num(space.pricePerDay),
  }
}

export type FormField = 'name' | 'capacity' | 'pricePerHour' | 'pricePerDay'
export type FormErrors = Partial<Record<FormField, string>>

/** Un entero positivo hasta `max`, escrito como texto: "10". Los vacíos son válidos (es un borrador). */
function integerError(value: string, max: number, what: string): string | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return `${what} debe ser un número entero mayor que 0.`
  if (n > max) return `${what} no puede superar ${max.toLocaleString('es-CL')}.`
  return undefined
}

/** Solo el nombre es obligatorio: el resto se completa con el tiempo y se exige al publicar (ES-04). */
export function validate(form: SpaceForm): FormErrors {
  const errors: FormErrors = {}
  if (form.name.trim() === '') errors.name = 'Ponle un nombre a tu espacio.'
  else if (form.name.trim().length > MAX_NAME) errors.name = `El nombre no puede superar ${MAX_NAME} caracteres.`

  const capacity = integerError(form.capacity, MAX_CAPACITY, 'La capacidad')
  if (capacity) errors.capacity = capacity
  const hour = integerError(form.pricePerHour, MAX_PRICE, 'El precio por hora')
  if (hour) errors.pricePerHour = hour
  const day = integerError(form.pricePerDay, MAX_PRICE, 'El precio por día')
  if (day) errors.pricePerDay = day
  return errors
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

/**
 * Cuerpo para guardar el borrador. Lo vacío se manda como null, así borrar un campo en el formulario
 * lo borra también en el servidor. La región es siempre la fija (por ahora solo la Metropolitana).
 */
export function toPayload(form: SpaceForm, regionId: number | null): SpacePayload {
  return {
    name: form.name.trim(),
    typeId: intOrNull(form.typeId),
    description: orNull(form.description),
    capacity: intOrNull(form.capacity),
    pricePerHour: intOrNull(form.pricePerHour),
    pricePerDay: intOrNull(form.pricePerDay),
    regionId,
    communeId: intOrNull(form.communeId),
    address: orNull(form.address),
    addressDetail: orNull(form.addressDetail),
    rules: orNull(form.rules),
    amenityIds: form.amenityIds,
  }
}

export interface ChecklistItem {
  label: string
  done: boolean
}

/**
 * Lo que se exige para publicar (ES-04). Las fotos (ES-03) y el horario semanal (DI-01) todavía no se
 * pueden cargar desde esta pantalla, por eso quedan pendientes.
 */
export function publishChecklist(form: SpaceForm): ChecklistItem[] {
  return [
    { label: 'Al menos una foto', done: false },
    { label: 'Precio por hora o por día', done: Number(form.pricePerHour) > 0 || Number(form.pricePerDay) > 0 },
    { label: 'Capacidad', done: Number(form.capacity) > 0 },
    { label: 'Descripción', done: form.description.trim() !== '' },
    { label: 'Horario semanal', done: false },
  ]
}

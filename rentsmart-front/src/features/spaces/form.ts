import { ApiError } from '../../lib/http'
import { CHILE_BOUNDS } from '../map/map-config'
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
  latitude: '',
  longitude: '',
  pricePerHour: '',
  pricePerDay: '',
}

const text = (value: string | null) => value ?? ''
const num = (value: number | null | undefined) => (value == null ? '' : String(value))

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
    latitude: num(space.latitude),
    longitude: num(space.longitude),
    pricePerHour: num(space.pricePerHour),
    pricePerDay: num(space.pricePerDay),
  }
}

export type FormField = 'name' | 'capacity' | 'pricePerHour' | 'pricePerDay' | 'latitude' | 'longitude'
export type FormErrors = Partial<Record<FormField, string>>

/** Un entero positivo hasta `max`, escrito como texto: "10". Los vacíos son válidos (es un borrador). */
function integerError(value: string, max: number, what: string): string | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return `${what} debe ser un número entero mayor que 0.`
  if (n > max) return `${what} no puede superar ${max.toLocaleString('es-CL')}.`
  return undefined
}

/** Una coordenada escrita como texto: un número dentro de Chile. Vacía es válida (el punto es opcional). */
function coordinateError(value: string, min: number, max: number, what: string): string | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return `${what} debe ser un número, por ejemplo -33.4489.`
  if (n < min || n > max) return `${what} debe estar entre ${min} y ${max}, dentro de Chile.`
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

  const latitude = coordinateError(form.latitude, CHILE_BOUNDS.minLat, CHILE_BOUNDS.maxLat, 'La latitud')
  if (latitude) errors.latitude = latitude
  const longitude = coordinateError(form.longitude, CHILE_BOUNDS.minLng, CHILE_BOUNDS.maxLng, 'La longitud')
  if (longitude) errors.longitude = longitude
  // El punto va completo: sin una de las dos coordenadas no hay dónde poner el pin.
  const hasLatitude = form.latitude.trim() !== ''
  if (!latitude && !longitude && hasLatitude !== (form.longitude.trim() !== '')) {
    errors[hasLatitude ? 'longitude' : 'latitude'] = `Falta la ${hasLatitude ? 'longitud' : 'latitud'}: completa las dos o quita el punto.`
  }
  return errors
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value))
/** Hasta 6 decimales (~0,1 m), que es lo que acepta el back. */
const coordinateOrNull = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 1e6) / 1e6)

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
    latitude: coordinateOrNull(form.latitude),
    longitude: coordinateOrNull(form.longitude),
    rules: orNull(form.rules),
    amenityIds: form.amenityIds,
  }
}

/** Lo que el back puede decir que falta para publicar (`missing` de la respuesta 409). */
export type MissingField = 'type' | 'description' | 'capacity' | 'commune' | 'price' | 'photos' | 'schedule'

/** Cada requisito para publicar, con su nombre y el paso del formulario donde se completa (P-18). */
export const REQUIREMENTS: Record<MissingField, { label: string; step: number }> = {
  type: { label: 'Tipo de espacio', step: 1 },
  description: { label: 'Descripción', step: 1 },
  capacity: { label: 'Capacidad', step: 1 },
  commune: { label: 'Comuna', step: 2 },
  price: { label: 'Precio por hora o por día', step: 3 },
  schedule: { label: 'Horario semanal', step: 3 },
  photos: { label: 'Al menos una foto', step: 4 },
}

export interface ChecklistItem {
  code: MissingField
  label: string
  step: number
  done: boolean
}

/**
 * Qué requisitos para publicar ya cumple el formulario. Las fotos y el horario semanal (DI-01) se guardan
 * aparte del borrador, por eso llegan como datos sueltos.
 */
export function publishChecklist(form: SpaceForm, photoCount: number, hasSchedule = false): ChecklistItem[] {
  const done: Record<MissingField, boolean> = {
    type: form.typeId !== '',
    description: form.description.trim() !== '',
    capacity: Number(form.capacity) > 0,
    commune: form.communeId !== '',
    price: Number(form.pricePerHour) > 0 || Number(form.pricePerDay) > 0,
    photos: photoCount > 0,
    schedule: hasSchedule,
  }
  return (Object.keys(REQUIREMENTS) as MissingField[]).map((code) => ({ code, ...REQUIREMENTS[code], done: done[code] }))
}

/** Lo que falta según un error 409 del back (`{ missing: [...] }`), o null si el error es de otra cosa. */
export function missingFromError(error: unknown): MissingField[] | null {
  const data = error instanceof ApiError ? error.data : null
  if (typeof data !== 'object' || data === null || !('missing' in data) || !Array.isArray(data.missing)) return null
  return data.missing.filter((code): code is MissingField => typeof code === 'string' && code in REQUIREMENTS)
}

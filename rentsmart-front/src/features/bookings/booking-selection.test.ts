import { describe, expect, it } from 'vitest'
import {
  addDays,
  checkoutDestination,
  estimateAmounts,
  FEE_PERCENT,
  formatDayLabel,
  formatRange,
  formatTime,
  hoursBetween,
  isContiguous,
  remainingLabel,
  todayInSantiago,
  toggleSlot,
} from './booking-selection'
import type { AvailabilitySlot } from './types'

// Lunes 12 de octubre de 2026: Chile está en UTC-3, así que las 09:00 son las 12:00 UTC.
const slot = (hourUtc: number): AvailabilitySlot => ({
  startAt: new Date(Date.UTC(2026, 9, 12, hourUtc)).toISOString(),
  endAt: new Date(Date.UTC(2026, 9, 12, hourUtc + 1)).toISOString(),
})
// 09:00, 10:00 y 11:00 seguidos; 13:00 después de una hora ocupada.
const SLOTS = [slot(12), slot(13), slot(14), slot(16)]

describe('estimateAmounts', () => {
  it('suma la comisión del 10 % al precio por hora por cada bloque', () => {
    expect(FEE_PERCENT).toBe(10)
    expect(estimateAmounts(12000, 'HOUR', 2)).toEqual({ subtotal: 24000, fee: 2400, total: 26400 })
  })

  it('por día cobra el precio por día, dure lo que dure', () => {
    expect(estimateAmounts(90000, 'DAY', 12)).toEqual({ subtotal: 90000, fee: 9000, total: 99000 })
  })

  it('redondea la comisión al peso, como el back', () => {
    expect(estimateAmounts(12345, 'HOUR', 1).fee).toBe(1235)
    expect(estimateAmounts(12344, 'HOUR', 1).fee).toBe(1234)
  })
})

describe('toggleSlot', () => {
  it('el primer toque elige un bloque y tocarlo de nuevo lo quita', () => {
    const one = toggleSlot(SLOTS, null, 1)

    expect(one).toEqual({ from: 1, to: 1 })
    expect(toggleSlot(SLOTS, one, 1)).toBeNull()
  })

  it('tocar un bloque posterior y seguido alarga la reserva hasta él', () => {
    expect(toggleSlot(SLOTS, { from: 0, to: 0 }, 2)).toEqual({ from: 0, to: 2 })
    // Desde una selección más larga, también acorta.
    expect(toggleSlot(SLOTS, { from: 0, to: 2 }, 1)).toEqual({ from: 0, to: 1 })
  })

  it('un bloque anterior o separado por una hora ocupada empieza una selección nueva', () => {
    expect(toggleSlot(SLOTS, { from: 1, to: 2 }, 0)).toEqual({ from: 0, to: 0 })
    expect(toggleSlot(SLOTS, { from: 0, to: 0 }, 3)).toEqual({ from: 3, to: 3 })
  })

  it('isContiguous revisa que cada bloque termine donde empieza el siguiente', () => {
    expect(isContiguous(SLOTS, 0, 2)).toBe(true)
    expect(isContiguous(SLOTS, 2, 3)).toBe(false)
    expect(isContiguous(SLOTS, 3, 3)).toBe(true)
  })
})

describe('fechas en la hora de Chile', () => {
  it('todayInSantiago usa el día de Chile, no el de UTC', () => {
    // El martes 13 a las 01:00 UTC todavía es el lunes 12 a las 22:00 en Chile.
    expect(todayInSantiago(new Date('2026-10-13T01:00:00Z'))).toBe('2026-10-12')
  })

  it('addDays cruza meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-25', 13)).toBe('2027-01-07')
  })

  it('formatDayLabel y formatTime muestran la hora de Chile', () => {
    expect(formatDayLabel('2026-10-12')).toBe('Lunes, 12 de octubre')
    expect(formatTime('2026-10-12T12:00:00.000Z')).toBe('09:00')
  })

  it('formatRange: un mismo día, hasta las 24:00 y cruzando la medianoche', () => {
    expect(formatRange('2026-10-12T13:00:00.000Z', '2026-10-12T15:00:00.000Z')).toBe('lun, 12 oct · 10:00 a 12:00')
    expect(formatRange('2026-10-12T12:00:00.000Z', '2026-10-13T03:00:00.000Z')).toBe('lun, 12 oct · 09:00 a 24:00')
    expect(formatRange('2026-10-13T01:00:00.000Z', '2026-10-13T05:00:00.000Z')).toBe('lun, 12 oct 22:00 a mar, 13 oct 02:00')
  })

  it('hoursBetween cuenta las horas del rango', () => {
    expect(hoursBetween('2026-10-12T13:00:00.000Z', '2026-10-12T15:00:00.000Z')).toBe(2)
  })
})

describe('remainingLabel', () => {
  const now = new Date('2026-10-12T12:00:00.000Z')

  it('muestra los minutos y segundos que quedan', () => {
    expect(remainingLabel('2026-10-12T12:30:00.000Z', now)).toBe('30:00')
    expect(remainingLabel('2026-10-12T12:01:05.000Z', now)).toBe('1:05')
    expect(remainingLabel('2026-10-12T12:00:00.500Z', now)).toBe('0:01')
  })

  it('es null cuando ya venció', () => {
    expect(remainingLabel('2026-10-12T12:00:00.000Z', now)).toBeNull()
    expect(remainingLabel('2026-10-12T11:59:00.000Z', now)).toBeNull()
  })
})

describe('checkoutDestination', () => {
  const ORIGIN = 'http://localhost:5173'

  it('del mismo origen: va a la página de la reserva dentro de la app', () => {
    expect(checkoutDestination('http://localhost:5173/bookings/b1', 'b1', ORIGIN)).toEqual({ inApp: true, path: '/bookings/b1' })
    expect(checkoutDestination('/bookings/b1', 'b1', ORIGIN)).toEqual({ inApp: true, path: '/bookings/b1' })
  })

  it('conserva el query string, como el ?pago=ok del mock de MSW (PA-01)', () => {
    expect(checkoutDestination('http://localhost:5173/bookings/b1?pago=ok', 'b1', ORIGIN)).toEqual({
      inApp: true,
      path: '/bookings/b1?pago=ok',
    })
    expect(checkoutDestination('http://127.0.0.1:5173/bookings/b1/?pago=cancelado', 'b1', ORIGIN)).toEqual({
      inApp: true,
      path: '/bookings/b1?pago=cancelado',
    })
  })

  it('con la ruta /bookings/<id> en otro origen (FRONTEND_URL distinto del front) también se queda en la app', () => {
    expect(checkoutDestination('http://127.0.0.1:5173/bookings/b1', 'b1', ORIGIN)).toEqual({ inApp: true, path: '/bookings/b1' })
    expect(checkoutDestination('https://rentsmart.test/bookings/b1/', 'b1', ORIGIN)).toEqual({ inApp: true, path: '/bookings/b1' })
  })

  it('otro sitio, como Stripe Checkout, es externo', () => {
    const stripe = 'https://checkout.stripe.com/c/pay/cs_test_123'

    expect(checkoutDestination(stripe, 'b1', ORIGIN)).toEqual({ inApp: false, url: stripe })
    expect(checkoutDestination('https://otro.test/bookings/b1/pagar', 'b1', ORIGIN)).toMatchObject({ inApp: false })
  })
})

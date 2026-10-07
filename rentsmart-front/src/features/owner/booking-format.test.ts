import { describe, expect, it } from 'vitest'
import {
  currentMonthInSantiago,
  DATE_PATTERN,
  formatBookingRange,
  formatHours,
  formatPercent,
  MONTH_PATTERN,
  monthLabel,
  shiftMonth,
  STATUS_LABELS,
  todayInSantiago,
} from './booking-format'

describe('formatBookingRange', () => {
  it('muestra el día y las horas en la hora de Chile, no en UTC', () => {
    // 16:00 UTC son las 13:00 en Chile en octubre (UTC-3).
    expect(formatBookingRange('2026-10-05T16:00:00Z', '2026-10-05T19:00:00Z')).toBe('lun, 5 oct · 13:00 a 16:00')
  })

  it('en invierno el desfase es otro (UTC-4)', () => {
    expect(formatBookingRange('2026-07-06T16:00:00Z', '2026-07-06T18:00:00Z')).toBe('lun, 6 jul · 12:00 a 14:00')
  })

  it('una reserva que cruza la medianoche lleva los dos días', () => {
    expect(formatBookingRange('2026-10-05T01:00:00Z', '2026-10-05T04:00:00Z')).toBe('dom, 4 oct 22:00 a lun, 5 oct 01:00')
  })

  it('a las 23:30 de Chile el día es el 3, aunque en UTC ya sea el 4', () => {
    expect(formatBookingRange('2026-10-04T02:30:00Z', '2026-10-04T03:30:00Z')).toBe('sáb, 3 oct 23:30 a dom, 4 oct 00:30')
  })
})

describe('hoy y el mes en Chile', () => {
  it('el día y el mes se miden en Chile, no en UTC', () => {
    // 02:30 UTC del 1 de octubre son las 23:30 del 30 de septiembre en Chile.
    const now = new Date('2026-10-01T02:30:00Z')

    expect(todayInSantiago(now)).toBe('2026-09-30')
    expect(currentMonthInSantiago(now)).toBe('2026-09')
  })

  it('después de la medianoche de Chile ya es el día siguiente', () => {
    expect(todayInSantiago(new Date('2026-10-01T03:00:00Z'))).toBe('2026-10-01')
  })
})

describe('meses', () => {
  it('monthLabel escribe el mes en español', () => {
    expect(monthLabel('2026-10')).toBe('octubre de 2026')
    expect(monthLabel('2027-01')).toBe('enero de 2027')
  })

  it.each([
    ['2026-10', -1, '2026-09'],
    ['2026-10', 1, '2026-11'],
    ['2026-01', -1, '2025-12'],
    ['2026-12', 1, '2027-01'],
    ['2026-10', 0, '2026-10'],
  ])('shiftMonth(%s, %d) es %s', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected)
  })

  it.each(['2026-10', '2099-12'])('%s es un mes válido', (value) => expect(MONTH_PATTERN.test(value)).toBe(true))
  it.each(['2026-13', '2026-1', '1999-10', 'octubre', '2026-10-01'])('%s no es un mes válido', (value) => expect(MONTH_PATTERN.test(value)).toBe(false))
})

describe('fechas', () => {
  it.each(['2026-10-03', '2026-02-31'])('%s tiene la forma de un día', (value) => expect(DATE_PATTERN.test(value)).toBe(true))
  it.each(['03-10-2026', '2026-13-01', '2026-10-32', ''])('«%s» no la tiene', (value) => expect(DATE_PATTERN.test(value)).toBe(false))
})

describe('números', () => {
  it('formatHours usa coma decimal solo si hace falta', () => {
    expect(formatHours(6)).toBe('6')
    expect(formatHours(1.5)).toBe('1,5')
    expect(formatHours(68)).toBe('68')
  })

  it('formatPercent redondea al entero', () => {
    expect(formatPercent(0.088)).toBe('9 %')
    expect(formatPercent(0)).toBe('0 %')
    expect(formatPercent(1)).toBe('100 %')
  })
})

describe('STATUS_LABELS', () => {
  it('tiene un nombre en español para cada estado', () => {
    expect(STATUS_LABELS).toEqual({
      PENDING: 'Pendiente',
      PAID: 'Pagada',
      CONFIRMED: 'Confirmada',
      FINISHED: 'Finalizada',
      CANCELLED: 'Cancelada',
      EXPIRED: 'Expirada',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { canCancel, reasonError, refundsOnCancel } from './cancellation'
import type { BookingStatus } from './types'

const START = '2026-10-20T15:00:00.000Z'
const MINUTE = 60_000
const before = (ms: number) => new Date(new Date(START).getTime() - ms)
const booking = (status: BookingStatus = 'CONFIRMED') => ({ status, startAt: START })

describe('refundsOnCancel (P-14)', () => {
  it.each([
    ['una semana antes', 7 * 24 * 60 * MINUTE, true],
    ['exactamente 24 horas antes', 24 * 60 * MINUTE, true],
    ['un minuto menos de 24 horas antes', 24 * 60 * MINUTE - MINUTE, false],
    ['una hora antes', 60 * MINUTE, false],
    ['con la reserva ya empezada', -MINUTE, false],
  ])('el arrendatario cancela %s', (_name, ms, expected) => {
    expect(refundsOnCancel(booking(), 'RENTER', before(ms))).toBe(expected)
  })

  it('si cancela el propietario siempre hay reembolso', () => {
    expect(refundsOnCancel(booking(), 'OWNER', before(7 * 24 * 60 * MINUTE))).toBe(true)
    expect(refundsOnCancel(booking(), 'OWNER', before(MINUTE))).toBe(true)
  })

  it('una reserva que no está confirmada no tiene nada que reembolsar', () => {
    expect(refundsOnCancel(booking('PENDING'), 'RENTER', before(7 * 24 * 60 * MINUTE))).toBe(false)
    expect(refundsOnCancel(booking('PENDING'), 'OWNER', before(7 * 24 * 60 * MINUTE))).toBe(false)
  })
})

describe('canCancel', () => {
  it('solo se cancela desde pendiente o confirmada', () => {
    const statuses: BookingStatus[] = ['PENDING', 'PAID', 'CONFIRMED', 'FINISHED', 'CANCELLED', 'EXPIRED']

    expect(statuses.filter(canCancel)).toEqual(['PENDING', 'CONFIRMED'])
  })
})

describe('reasonError', () => {
  it('pide un motivo de 5 a 500 caracteres, sin contar los espacios de los extremos', () => {
    expect(reasonError('')).toBe('Escribe el motivo de la cancelación.')
    expect(reasonError('     ')).toBe('Escribe el motivo de la cancelación.')
    expect(reasonError('  nada  ')).toBe('El motivo debe tener al menos 5 caracteres.')
    expect(reasonError('a'.repeat(501))).toBe('El motivo no puede superar los 500 caracteres.')
    expect(reasonError('Viaje')).toBeNull()
    expect(reasonError(` ${'a'.repeat(500)} `)).toBeNull()
  })
})

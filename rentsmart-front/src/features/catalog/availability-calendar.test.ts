import { describe, expect, it } from 'vitest'
import type { AvailabilityDay } from '../bookings/types'
import { buildCalendarDays, hourLabel, scheduledHours } from './availability-calendar'
import type { ScheduleRule } from './types'

// Octubre de 2026 está en horario de verano (UTC-3): las 09:00 de Chile son las 12:00Z.
const WEEKDAYS: ScheduleRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '12:00' }))
const slot = (day: string, chileHour: number) => ({
  startAt: `${day}T${String(chileHour + 3).padStart(2, '0')}:00:00.000Z`,
  endAt: `${day}T${String(chileHour + 4).padStart(2, '0')}:00:00.000Z`,
})

describe('scheduledHours', () => {
  it('devuelve las horas de inicio de los bloques de ese día de la semana', () => {
    expect(scheduledHours(WEEKDAYS, 1)).toEqual([9, 10, 11])
    expect(scheduledHours(WEEKDAYS, 6)).toEqual([])
    expect(scheduledHours(WEEKDAYS, 0)).toEqual([])
  })

  it('une varios rangos del mismo día en orden y sin repetir', () => {
    const rules: ScheduleRule[] = [
      { weekday: 2, startTime: '15:00', endTime: '17:00' },
      { weekday: 2, startTime: '09:00', endTime: '11:00' },
    ]
    expect(scheduledHours(rules, 2)).toEqual([9, 10, 15, 16])
  })

  it('un horario que llega a las 24:00 incluye la última hora del día', () => {
    expect(scheduledHours([{ weekday: 5, startTime: '22:00', endTime: '24:00' }], 5)).toEqual([22, 23])
  })
})

describe('hourLabel', () => {
  it('rellena con cero', () => {
    expect(hourLabel(9)).toBe('09:00')
    expect(hourLabel(21)).toBe('21:00')
  })
})

describe('buildCalendarDays', () => {
  // Lunes 12 de octubre y sábado 17.
  const days: AvailabilityDay[] = [
    { date: '2026-10-12', slots: [slot('2026-10-12', 11)], fullDay: { startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z', available: false } },
    { date: '2026-10-17', slots: [], fullDay: null },
  ]

  it('marca como libres los bloques que trae la disponibilidad y como ocupados el resto del horario', () => {
    const [monday] = buildCalendarDays(WEEKDAYS, days, new Date('2026-10-11T12:00:00Z'))

    expect(monday.cells.map((cell) => [cell.hour, cell.state])).toEqual([
      [9, 'busy'],
      [10, 'busy'],
      [11, 'free'],
    ])
    expect(monday.cells[2]).toMatchObject({ startAt: '2026-10-12T14:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z' })
    expect(monday.cells[0]).toMatchObject({ startAt: null, endAt: null })
  })

  it('en el día de hoy, las horas que ya empezaron pasan a ser "pasadas" en vez de ocupadas', () => {
    // 10:30 en Chile.
    const [monday] = buildCalendarDays(WEEKDAYS, days, new Date('2026-10-12T13:30:00Z'))

    expect(monday.cells.map((cell) => cell.state)).toEqual(['past', 'past', 'free'])
  })

  it('un día sin horario queda cerrado y sin bloques', () => {
    const [, saturday] = buildCalendarDays(WEEKDAYS, days, new Date('2026-10-11T12:00:00Z'))

    expect(saturday).toMatchObject({ date: '2026-10-17', closed: true, cells: [], fullDay: null })
  })

  it('el día completo se marca libre u ocupado según la disponibilidad', () => {
    const [busy] = buildCalendarDays(WEEKDAYS, days, new Date('2026-10-11T12:00:00Z'))
    const [free] = buildCalendarDays(
      WEEKDAYS,
      [{ ...days[0], fullDay: { ...days[0].fullDay!, available: true } }],
      new Date('2026-10-11T12:00:00Z'),
    )

    expect(busy.fullDay).toEqual({ state: 'busy', startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T15:00:00.000Z' })
    expect(free.fullDay?.state).toBe('free')
  })

  it('el día de la semana se calcula sobre el calendario, no sobre la zona del navegador', () => {
    // El 1 de enero de 2027 es viernes.
    const [friday] = buildCalendarDays(WEEKDAYS, [{ date: '2027-01-01', slots: [], fullDay: null }], new Date('2026-12-31T12:00:00Z'))

    expect(friday.cells.map((cell) => cell.hour)).toEqual([9, 10, 11])
  })
})

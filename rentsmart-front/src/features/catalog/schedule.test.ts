import { describe, expect, it } from 'vitest'
import { groupSchedule } from './schedule'
import type { ScheduleRule } from './types'

const rule = (weekday: number, startTime = '09:00', endTime = '21:00'): ScheduleRule => ({ weekday, startTime, endTime })

describe('groupSchedule', () => {
  it('agrupa de lunes a viernes y deja el fin de semana como no disponible', () => {
    const rows = groupSchedule([1, 2, 3, 4, 5].map((day) => rule(day)))

    expect(rows).toEqual([
      { days: 'Lunes a viernes', hours: '09:00 – 21:00' },
      { days: 'Sábado y domingo', hours: null },
    ])
  })

  it('sin reglas todos los días quedan no disponibles', () => {
    expect(groupSchedule([])).toEqual([{ days: 'Lunes a domingo', hours: null }])
  })

  it('todos los días con el mismo horario forman una sola fila', () => {
    expect(groupSchedule([0, 1, 2, 3, 4, 5, 6].map((day) => rule(day)))).toEqual([
      { days: 'Lunes a domingo', hours: '09:00 – 21:00' },
    ])
  })

  it('el domingo (0) va al final de la semana, no al principio', () => {
    const rows = groupSchedule([rule(6), rule(0)])

    expect(rows).toEqual([
      { days: 'Lunes a viernes', hours: null },
      { days: 'Sábado y domingo', hours: '09:00 – 21:00' },
    ])
  })

  it('separa los días con horarios distintos y nombra un día suelto', () => {
    const rows = groupSchedule([rule(1), rule(2), rule(3, '10:00', '14:00'), rule(4), rule(5)])

    expect(rows).toEqual([
      { days: 'Lunes y martes', hours: '09:00 – 21:00' },
      { days: 'Miércoles', hours: '10:00 – 14:00' },
      { days: 'Jueves y viernes', hours: '09:00 – 21:00' },
      { days: 'Sábado y domingo', hours: null },
    ])
  })

  it('un día con dos tramos los muestra juntos y en orden', () => {
    const rows = groupSchedule([rule(1, '15:00', '18:00'), rule(1, '09:00', '12:00')])

    expect(rows[0]).toEqual({ days: 'Lunes', hours: '09:00 – 12:00, 15:00 – 18:00' })
  })
})

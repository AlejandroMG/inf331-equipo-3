import { describe, expect, it } from 'vitest'
import { dayError, emptyWeek, END_TIMES, nextRange, START_TIMES, toRules, toWeek } from './schedule-form'

const range = (startTime: string, endTime: string) => ({ startTime, endTime })

describe('schedule-form', () => {
  it('ofrece inicios de 00:00 a 23:00 y fines de 01:00 a 24:00', () => {
    expect(START_TIMES).toHaveLength(24)
    expect([START_TIMES[0], START_TIMES[23]]).toEqual(['00:00', '23:00'])
    expect([END_TIMES[0], END_TIMES[23]]).toEqual(['01:00', '24:00'])
  })

  it('reparte las reglas por día, cada día por hora de inicio', () => {
    const week = toWeek([
      { weekday: 1, startTime: '15:00', endTime: '18:00' },
      { weekday: 0, startTime: '10:00', endTime: '24:00' },
      { weekday: 1, startTime: '09:00', endTime: '13:00' },
    ])

    expect(week[1]).toEqual([range('09:00', '13:00'), range('15:00', '18:00')])
    expect(week[0]).toEqual([range('10:00', '24:00')])
    expect(week[2]).toEqual([])
  })

  it('arma las reglas de lunes a domingo y no manda los días sin rangos', () => {
    const week = { ...emptyWeek(), 0: [range('10:00', '14:00')], 1: [range('09:00', '13:00'), range('15:00', '18:00')] }

    expect(toRules(week)).toEqual([
      { weekday: 1, startTime: '09:00', endTime: '13:00' },
      { weekday: 1, startTime: '15:00', endTime: '18:00' },
      { weekday: 0, startTime: '10:00', endTime: '14:00' },
    ])
    expect(toRules(emptyWeek())).toEqual([])
  })

  it.each([
    ['sin rangos', []],
    ['un rango hasta las 24:00', [range('00:00', '24:00')]],
    ['dos contiguos', [range('09:00', '13:00'), range('13:00', '18:00')]],
    ['dos separados, en desorden', [range('15:00', '18:00'), range('09:00', '13:00')]],
  ])('vale un día %s', (_name, ranges) => {
    expect(dayError(ranges)).toBeNull()
  })

  it('no vale un fin que no es posterior al inicio ni dos rangos traslapados', () => {
    expect(dayError([range('09:00', '09:00')])).toBe('El fin debe ser posterior al inicio.')
    expect(dayError([range('12:00', '09:00')])).toBe('El fin debe ser posterior al inicio.')
    expect(dayError([range('12:00', '18:00'), range('09:00', '13:00')])).toBe('Los rangos no pueden traslaparse.')
  })

  it('el rango siguiente parte en el último fin, y no hay más si el día llega a las 24:00', () => {
    expect(nextRange([range('09:00', '18:00')])).toEqual(range('18:00', '19:00'))
    expect(nextRange([range('15:00', '23:00'), range('09:00', '13:00')])).toEqual(range('23:00', '24:00'))
    expect(nextRange([range('09:00', '24:00')])).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { cn } from './cn'
import { formatClp } from './format'

describe('formatClp', () => {
  it.each([
    [0, '$0'],
    [999, '$999'],
    [12000, '$12.000'],
    [1250000, '$1.250.000'],
  ])('formatea %i como %s', (amount, expected) => {
    expect(formatClp(amount)).toBe(expected)
  })

  it('redondea los decimales a pesos enteros', () => {
    expect(formatClp(1500.6)).toBe('$1.501')
  })
})

describe('cn', () => {
  it('une las clases y omite los valores vacíos', () => {
    expect(cn('a', false, null, undefined, 'b', '')).toBe('a b')
  })
})

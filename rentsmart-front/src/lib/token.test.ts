import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearToken, getToken, setToken } from './token'

describe('token', () => {
  afterEach(() => vi.restoreAllMocks())

  it('guarda, lee y borra el token', () => {
    expect(getToken()).toBeNull()

    setToken('abc')
    expect(getToken()).toBe('abc')

    clearToken()
    expect(getToken()).toBeNull()
  })

  it('sigue funcionando sin sesión si localStorage falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    expect(getToken()).toBeNull()
    expect(() => setToken('abc')).not.toThrow()
    expect(() => clearToken()).not.toThrow()
  })
})

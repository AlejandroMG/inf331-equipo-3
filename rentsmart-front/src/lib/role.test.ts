import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/jwt'
import { roleFromToken, useRole } from './role'
import { clearToken, setToken } from './token'

describe('roleFromToken', () => {
  it.each(['ADMIN', 'USER'] as const)('lee el rol %s del contenido del token', (role) => {
    expect(roleFromToken(fakeJwt(role))).toBe(role)
  })

  it('sin token no hay rol', () => {
    expect(roleFromToken(null)).toBeNull()
    expect(roleFromToken('')).toBeNull()
  })

  it.each([
    ['un token que no es un JWT', 'dev'],
    ['un contenido que no es base64', 'a.@@@.c'],
    ['un contenido que no es JSON', `a.${btoa('no es json')}.c`],
    ['un contenido sin rol', `a.${btoa(JSON.stringify({ sub: 'u1' }))}.c`],
    ['un rol que no existe', fakeJwt('SUPERUSUARIO')],
    ['un rol que no es texto', `a.${btoa(JSON.stringify({ role: 1 }))}.c`],
  ])('con %s no hay rol', (_name, token) => {
    expect(roleFromToken(token)).toBeNull()
  })

  it('entiende el base64url con guiones y sin relleno, y los acentos', () => {
    // El contenido lleva un nombre con tilde y caracteres que en base64url cambian de forma.
    const token = fakeJwt('ADMIN', { name: 'Ñandú ?>>>' })

    expect(roleFromToken(token)).toBe('ADMIN')
  })
})

describe('useRole', () => {
  it('sigue a la sesión: sin sesión no hay rol, al iniciarla lo da y al cerrarla vuelve a null', () => {
    const { result } = renderHook(() => useRole())
    expect(result.current).toBeNull()

    act(() => setToken(fakeJwt('ADMIN')))
    expect(result.current).toBe('ADMIN')

    act(() => clearToken())
    expect(result.current).toBeNull()
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRequest } from './useRequest'

describe('useRequest', () => {
  it('empieza cargando y luego entrega el dato', async () => {
    const { result } = renderHook(() => useRequest('a', async () => 'dato'))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('dato')
    expect(result.current.error).toBeUndefined()
  })

  it('entrega el error si la petición falla', async () => {
    const { result } = renderHook(() =>
      useRequest('a', async () => {
        throw new Error('falló')
      }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('falló')
    expect(result.current.data).toBeUndefined()
  })

  it('al cambiar la clave vuelve a cargar y no muestra el dato anterior', async () => {
    const { result, rerender } = renderHook(({ key }) => useRequest(key, async () => `dato ${key}`), {
      initialProps: { key: 'a' },
    })
    await waitFor(() => expect(result.current.data).toBe('dato a'))

    rerender({ key: 'b' })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.data).toBe('dato b'))
  })

  it('no vuelve a pedir cuando solo cambia la función y no la clave', async () => {
    const load = vi.fn(async () => 'dato')
    const { result, rerender } = renderHook(() => useRequest('a', () => load()))
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender()
    rerender()

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('retry repite la petición', async () => {
    const load = vi.fn(async () => 'dato')
    const { result } = renderHook(() => useRequest('a', load))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.retry())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('cancela la petición al desmontar y descarta su resultado', async () => {
    let signal: AbortSignal | undefined
    const { unmount } = renderHook(() =>
      useRequest('a', (s) => {
        signal = s
        return new Promise<string>(() => undefined)
      }),
    )

    unmount()

    expect(signal?.aborted).toBe(true)
  })
})

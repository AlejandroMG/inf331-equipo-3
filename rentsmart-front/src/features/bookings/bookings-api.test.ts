import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { getAvailability } from './bookings-api'

// Contra el mock de MSW (src/mocks/bookings-handlers.ts), que responde con la misma forma que el back.
// El lunes 12 de octubre de 2026 Chile está en UTC-3: las 09:00 son las 12:00 UTC.
const SPACE = 'seed-space-1'

describe('getAvailability', () => {
  it('trae un día por fecha pedida, con los bloques libres en UTC y el día completo', async () => {
    const { spaceId, timeZone, days } = await getAvailability(SPACE, '2026-10-11', '2026-10-12')

    expect(spaceId).toBe(SPACE)
    expect(timeZone).toBe('America/Santiago')
    expect(days.map((day) => day.date)).toEqual(['2026-10-11', '2026-10-12'])
    expect(days[0]).toEqual({ date: '2026-10-11', slots: [], fullDay: null })
    expect(days[1].slots[0]).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-12T13:00:00.000Z' })
    expect(days[1].fullDay).toEqual({ startAt: '2026-10-12T12:00:00.000Z', endAt: '2026-10-13T00:00:00.000Z', available: true })
  })

  it('manda from y to en la query y codifica el id del espacio', async () => {
    let url: URL | undefined
    server.use(
      http.get('*/api/spaces/:id/availability', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ spaceId: 'a/b', timeZone: 'America/Santiago', days: [] })
      }),
    )

    await getAvailability('a/b', '2026-10-12', '2026-10-18')

    expect(url?.pathname).toBe('/api/spaces/a%2Fb/availability')
    expect(url?.searchParams.get('from')).toBe('2026-10-12')
    expect(url?.searchParams.get('to')).toBe('2026-10-18')
  })

  it('rechaza con el código de la API: 400 por el rango y 404 si el espacio no existe', async () => {
    await expect(getAvailability(SPACE, '2026-10-13', '2026-10-12')).rejects.toMatchObject({ status: 400 })
    await expect(getAvailability(SPACE, '2026-10-01', '2026-11-01')).rejects.toMatchObject({ status: 400 })
    await expect(getAvailability('no-existe', '2026-10-12', '2026-10-12')).rejects.toMatchObject({ status: 404 })
  })

  it('se puede cancelar con un AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(getAvailability(SPACE, '2026-10-12', '2026-10-12', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

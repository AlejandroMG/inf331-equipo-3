import { http as mswHttp, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/server'
import { ApiError, createHttpClient, type HttpClientConfig } from './http'

const BASE = 'http://api.test'

function client(config: Partial<HttpClientConfig> = {}) {
  return createHttpClient({ baseUrl: BASE, getToken: () => null, ...config })
}

describe('createHttpClient', () => {
  it('agrega /api a la ruta y devuelve el JSON', async () => {
    server.use(mswHttp.get(`${BASE}/api/ping`, () => HttpResponse.json({ ok: true })))

    await expect(client().get('/ping')).resolves.toEqual({ ok: true })
  })

  it('adjunta el token como Bearer cuando hay sesión', async () => {
    let authorization: string | null = null
    server.use(
      mswHttp.get(`${BASE}/api/me`, ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )

    await client({ getToken: () => 'abc123' }).get('/me')

    expect(authorization).toBe('Bearer abc123')
  })

  it('no envía Authorization sin sesión', async () => {
    let authorization: string | null = 'pendiente'
    server.use(
      mswHttp.get(`${BASE}/api/public`, ({ request }) => {
        authorization = request.headers.get('authorization')
        return HttpResponse.json({})
      }),
    )

    await client().get('/public')

    expect(authorization).toBeNull()
  })

  it('arma el query string y omite los valores vacíos', async () => {
    let search = ''
    server.use(
      mswHttp.get(`${BASE}/api/catalog`, ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json([])
      }),
    )

    await client().get('/catalog', { params: { page: 2, q: 'sala', communeId: undefined, typeId: null, minPrice: '' } })

    expect(search).toBe('?page=2&q=sala')
  })

  it('envía un objeto como JSON', async () => {
    let received: { contentType: string | null; body: unknown } | null = null
    server.use(
      mswHttp.post(`${BASE}/api/spaces`, async ({ request }) => {
        received = { contentType: request.headers.get('content-type'), body: await request.json() }
        return HttpResponse.json({ id: 'abc' }, { status: 201 })
      }),
    )

    const created = await client().post('/spaces', { name: 'Sala Alameda' })

    expect(created).toEqual({ id: 'abc' })
    expect(received).toEqual({ contentType: 'application/json', body: { name: 'Sala Alameda' } })
  })

  it('envía un FormData sin forzar Content-Type JSON (subida de fotos)', async () => {
    let contentType: string | null = null
    server.use(
      mswHttp.post(`${BASE}/api/spaces/1/photos`, ({ request }) => {
        contentType = request.headers.get('content-type')
        return HttpResponse.json({})
      }),
    )
    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'foto.png')

    await client().post('/spaces/1/photos', form)

    expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
  })

  it('devuelve undefined ante un 204', async () => {
    server.use(mswHttp.delete(`${BASE}/api/spaces/1/photos/2`, () => new HttpResponse(null, { status: 204 })))

    await expect(client().delete('/spaces/1/photos/2')).resolves.toBeUndefined()
  })

  describe('errores', () => {
    it('usa el mensaje que manda la API', async () => {
      server.use(mswHttp.get(`${BASE}/api/x`, () => HttpResponse.json({ message: 'Ya existe' }, { status: 409 })))

      const error = await client().get('/x').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status: 409, message: 'Ya existe', data: { message: 'Ya existe' } })
    })

    it('une los mensajes cuando la validación devuelve una lista', async () => {
      server.use(
        mswHttp.post(`${BASE}/api/x`, () =>
          HttpResponse.json({ message: ['name no puede estar vacío', 'capacity debe ser positivo'] }, { status: 400 }),
        ),
      )

      await expect(client().post('/x', {})).rejects.toMatchObject({
        status: 400,
        message: 'name no puede estar vacío capacity debe ser positivo',
      })
    })

    it.each([
      [400, 'Los datos enviados no son válidos.'],
      [401, 'Tu sesión expiró. Inicia sesión de nuevo.'],
      [403, 'No tienes permiso para hacer esto.'],
      [404, 'No encontramos lo que buscas.'],
      [409, 'La acción entra en conflicto con el estado actual.'],
      [500, 'Ocurrió un error en el servidor. Intenta de nuevo.'],
      [418, 'Algo salió mal. Intenta de nuevo.'],
    ])('con un %i sin mensaje usa el texto por defecto', async (status, message) => {
      server.use(mswHttp.get(`${BASE}/api/x`, () => new HttpResponse(null, { status })))

      await expect(client().get('/x')).rejects.toMatchObject({ status, message })
    })

    it('avisa ante un 401 para que se borre la sesión', async () => {
      const onUnauthorized = vi.fn()
      server.use(mswHttp.get(`${BASE}/api/me`, () => new HttpResponse(null, { status: 401 })))

      await expect(client({ onUnauthorized }).get('/me')).rejects.toBeInstanceOf(ApiError)

      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    it('no avisa de sesión vencida con otros errores', async () => {
      const onUnauthorized = vi.fn()
      server.use(mswHttp.get(`${BASE}/api/x`, () => new HttpResponse(null, { status: 403 })))

      await client({ onUnauthorized }).get('/x').catch(() => undefined)

      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    it('convierte un fallo de red en ApiError con status 0', async () => {
      server.use(mswHttp.get(`${BASE}/api/x`, () => HttpResponse.error()))

      await expect(client().get('/x')).rejects.toMatchObject({
        status: 0,
        message: 'No pudimos conectar con el servidor. Revisa tu conexión.',
      })
    })

    it('deja pasar la cancelación sin convertirla', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(client().get('/x', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    })
  })
})

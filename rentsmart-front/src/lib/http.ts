import { clearToken, getToken } from './token'

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  /** Query string; se omiten los valores null, undefined y vacíos. */
  params?: QueryParams
  /** Cuerpo: un objeto se envía como JSON y un FormData se envía tal cual (fotos). */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface HttpClientConfig {
  /** URL base del servidor, sin /api. */
  baseUrl: string
  getToken: () => string | null
  /** Se llama ante un 401 (token vencido o inválido). */
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
}

/** Error de una respuesta no exitosa o de red. status 0 significa que no hubo respuesta. */
export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscas.',
  409: 'La acción entra en conflicto con el estado actual.',
}

function defaultMessage(status: number): string {
  if (status >= 500) return 'Ocurrió un error en el servidor. Intenta de nuevo.'
  return DEFAULT_MESSAGES[status] ?? 'Algo salió mal. Intenta de nuevo.'
}

// Nest responde { message: string | string[] }; los DTOs inválidos traen una lista.
function messageFromBody(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) return null
  const { message } = data as { message: unknown }
  if (typeof message === 'string' && message) return message
  if (Array.isArray(message) && message.length > 0) return message.join(' ')
  return null
}

function buildUrl(baseUrl: string, path: string, params?: QueryParams): string {
  const url = new URL(`/api${path}`, baseUrl)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createHttpClient(config: HttpClientConfig) {
  // Se llama a fetch al momento de usarlo (no se guarda la referencia) para que se pueda sustituir en tests.
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((input, init) => fetch(input, init))

  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    const token = config.getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    let body: BodyInit | undefined
    if (options.body instanceof FormData) {
      body = options.body // el navegador agrega el boundary; no se fija Content-Type
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await fetchImpl(buildUrl(config.baseUrl, path, options.params), {
        method,
        headers,
        body,
        signal: options.signal,
      })
    } catch (error) {
      // Cancelar una petición no es un fallo de red. Se compara por nombre porque la clase DOMException puede ser distinta según el entorno.
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error
      throw new ApiError(0, 'No pudimos conectar con el servidor. Revisa tu conexión.')
    }

    const data = await parseBody(response)
    if (!response.ok) {
      if (response.status === 401) config.onUnauthorized?.()
      throw new ApiError(response.status, messageFromBody(data) ?? defaultMessage(response.status), data)
    }
    return data as T
  }

  return {
    request,
    get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PATCH', path, { ...options, body }),
    put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PUT', path, { ...options, body }),
    delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('DELETE', path, options),
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>

/** Cliente de la app: lee VITE_API_URL y el token guardado. Ante un 401 borra el token. */
export const http = createHttpClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  getToken,
  onUnauthorized: clearToken,
})

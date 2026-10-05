import { http } from '../../lib/http'

export interface RegisterInput {
  name: string
  email: string
  password: string
}

/** Usuario tal como lo devuelve la API: nunca incluye la contraseña. */
export interface PublicUser {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  isHost: boolean
  createdAt: string
}

export function register(input: RegisterInput): Promise<PublicUser> {
  return http.post<PublicUser>('/auth/register', input)
}

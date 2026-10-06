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

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: PublicUser
}

export function login(input: LoginInput): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/login', input)
}

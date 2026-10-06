import type { LoginInput, RegisterInput } from './api'

export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>
export type LoginErrors = Partial<Record<keyof LoginInput, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Las mismas reglas que valida la API, para avisar antes de enviar. */
export function validateRegister(values: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {}
  if (!values.name.trim()) errors.name = 'El nombre es obligatorio.'
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Ingresa un email válido.'
  if (values.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.'
  else if (values.password.length > 72) errors.password = 'La contraseña puede tener hasta 72 caracteres.'
  return errors
}

/** Al iniciar sesión solo se revisa que estén los datos; las reglas de la contraseña no se revelan. */
export function validateLogin(values: LoginInput): LoginErrors {
  const errors: LoginErrors = {}
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Ingresa un email válido.'
  if (!values.password) errors.password = 'Ingresa tu contraseña.'
  return errors
}

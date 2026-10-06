import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { useToast } from '../../components/toast-context'
import { ApiError } from '../../lib/http'
import { paths } from '../../lib/paths'
import { setToken } from '../../lib/token'
import { login, type LoginInput } from './api'
import { validateLogin, type LoginErrors } from './validation'

// RequireAuth deja la ruta pedida en `from`; el registro deja el email recién creado en `email`.
interface LoginLocationState {
  from?: string
  email?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const state = (useLocation().state ?? {}) as LoginLocationState
  const [values, setValues] = useState<LoginInput>({ email: state.email ?? '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof LoginInput) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const found = validateLogin(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const { accessToken, user } = await login({ email: values.email.trim(), password: values.password })
      setToken(accessToken)
      toast.show(`Hola, ${user.name}.`)
      navigate(state.from ?? paths.home, { replace: true })
    } catch (error) {
      // 401 (credenciales) y 403 (cuenta suspendida) traen su mensaje desde la API.
      setFormError(error instanceof ApiError ? error.message : 'Algo salió mal. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Iniciar sesión</h1>
      <p className="mt-2 text-muted">Ingresa para reservar espacios o publicar los tuyos.</p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update('email')}
            error={errors.email}
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
          />

          {formError && (
            <p role="alert" className="text-[15px] font-semibold text-accent-ink">
              {formError}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            Ingresar
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-[15px]">
        ¿No tienes cuenta? <Link to={paths.register}>Crear cuenta</Link>
      </p>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { useToast } from '../../components/toast-context'
import { ApiError } from '../../lib/http'
import { paths } from '../../lib/paths'
import { register, type RegisterInput } from './api'
import { validateRegister, type RegisterErrors as FieldErrors } from './validation'

type Field = keyof RegisterInput

export function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [values, setValues] = useState<RegisterInput>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: Field) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const found = validateRegister(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await register({ ...values, name: values.name.trim(), email: values.email.trim() })
      toast.show('Cuenta creada. Ahora inicia sesión.')
      navigate(paths.login, { state: { email: values.email.trim().toLowerCase() } })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: error.message })
      } else {
        setFormError(error instanceof ApiError ? error.message : 'Algo salió mal. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Crea tu cuenta</h1>
      <p className="mt-2 text-muted">Con una misma cuenta puedes reservar espacios y publicar los tuyos.</p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Input
            label="Nombre"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={update('name')}
            error={errors.name}
          />
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
            autoComplete="new-password"
            value={values.password}
            onChange={update('password')}
            error={errors.password}
            hint="Mínimo 8 caracteres."
          />

          {formError && (
            <p role="alert" className="text-[15px] font-semibold text-accent-ink">
              {formError}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            Crear cuenta
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-[15px]">
        ¿Ya tienes cuenta? <Link to={paths.login}>Inicia sesión</Link>
      </p>
    </div>
  )
}

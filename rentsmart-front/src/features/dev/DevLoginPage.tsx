import { useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { paths } from '../../lib/paths'
import { setToken } from '../../lib/token'

/**
 * Inicio de sesión de desarrollo: guarda un token cualquiera para pasar `RequireAuth`.
 * Existe solo mientras A no entrega el login real (CU-02) y solo en desarrollo (ver routes.tsx).
 */
export function DevLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? paths.home

  function enter() {
    setToken('dev')
    navigate(from, { replace: true })
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Iniciar sesión</h1>
      <Card className="mt-6 flex max-w-xl flex-col items-start gap-4">
        <p className="text-muted">
          Pantalla de desarrollo: el inicio de sesión real llega con la historia CU-02. Por ahora entras como el
          propietario de prueba del seed.
        </p>
        <Button onClick={enter}>Entrar como propietario de prueba</Button>
      </Card>
    </div>
  )
}

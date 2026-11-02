import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { useToast } from '../../components/toast-context'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { enableHost, me } from './api'

export function ProfilePage() {
  usePageTitle('Mi perfil')
  const toast = useToast()
  const { data, error, loading, retry } = useRequest('profile', me)
  const [updatedUser, setUpdatedUser] = useState<typeof data>()
  const [saving, setSaving] = useState(false)
  const user = updatedUser ?? data

  async function activateHostMode() {
    setSaving(true)
    try {
      const updated = await enableHost()
      setUpdatedUser(updated)
      toast.show('Ya puedes publicar espacios como propietario.')
    } catch (failure) {
      toast.show(
        failure instanceof Error
          ? failure.message
          : 'No pudimos habilitar el modo propietario. Intenta de nuevo.',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Mi perfil</h1>
      <p className="mt-2 text-[15px] text-muted">Administra tu cuenta de RentSmart.</p>

      {loading && (
        <p role="status" className="mt-6 text-muted">Cargando tu perfil…</p>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tu perfil.</p>
          <p className="mt-1 text-sm">{error.message}</p>
          <Button variant="secondary" className="mt-4" onClick={retry}>Reintentar</Button>
        </div>
      )}

      {user && (
        <Card className="mt-6">
          <h2 className="font-display text-xl font-bold">{user.name}</h2>
          <p className="mt-1 text-muted">{user.email}</p>
          <section aria-labelledby="host-mode-title" className="mt-6 border-t border-line pt-5">
            <h3 id="host-mode-title" className="font-semibold">Modo propietario</h3>
            {user.isHost ? (
              <p className="mt-2 text-muted">Tu cuenta está habilitada para publicar espacios.</p>
            ) : (
              <>
                <p className="mt-2 text-muted">
                  Activa este modo para empezar a publicar tus espacios. También se activa al publicar tu primer espacio.
                </p>
                <Button className="mt-4" loading={saving} onClick={activateHostMode}>
                  Habilitarme como propietario
                </Button>
              </>
            )}
          </section>
          <Link className="mt-5 inline-block font-semibold text-primary-dark underline" to={paths.ownerSpaces}>
            Ir a Mis espacios
          </Link>
        </Card>
      )}
    </div>
  )
}

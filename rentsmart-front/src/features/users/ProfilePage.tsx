import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { usePageTitle } from '../../lib/page-title'
import { useRequest } from '../../lib/useRequest'
import { fetchMyProfile, removeProfilePhoto, updateProfile, uploadProfilePhoto } from './api'

export function ProfilePage() {
  const { data, error: loadError, loading, retry } = useRequest('my-profile', fetchMyProfile)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  usePageTitle('Mi perfil')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    const formData = new FormData(event.currentTarget)
    try {
      await updateProfile({
        name: String(formData.get('name') ?? ''),
        phone: String(formData.get('phone') ?? '') || null,
        bio: String(formData.get('bio') ?? '') || null,
      })
      setMessage('Tus cambios se guardaron.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar tus cambios.')
    } finally {
      setSaving(false)
    }
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setMessage('')
    setError('')
    try {
      await uploadProfilePhoto(file)
      retry()
      setMessage('Tu foto de perfil se actualizó.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos subir la foto.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function clearPhoto() {
    setPhotoBusy(true)
    setMessage('')
    setError('')
    try {
      await removeProfilePhoto()
      retry()
      setMessage('Quitaste tu foto de perfil.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos quitar la foto.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-[40px]">Mi perfil</h1>
      <p className="mt-2 text-muted">Mantén actualizada la información que compartes en RentSmart.</p>

      {loading && <p role="status" className="mt-8 text-muted">Cargando tu perfil…</p>}
      {loadError && (
        <div role="alert" className="mt-8 rounded-card border border-accent bg-accent-soft p-5 text-accent-ink">
          <p className="font-semibold">No pudimos cargar tu perfil.</p>
          <p className="mt-1 text-sm">{loadError.message}</p>
          <Button variant="secondary" onClick={retry} className="mt-4">Reintentar</Button>
        </div>
      )}

      {data && (
        <>
          <section aria-labelledby="profile-photo-title" className="mt-8 rounded-card border border-line bg-white p-5 sm:p-7">
            <h2 id="profile-photo-title" className="font-display text-xl font-bold">Foto de perfil</h2>
            <div className="mt-5 flex flex-wrap items-center gap-5">
              {data.profilePhotoUrl ? (
                <img src={data.profilePhotoUrl} alt={`Foto de ${data.name}`} className="size-24 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="inline-flex size-24 items-center justify-center rounded-full bg-primary-soft font-display text-3xl font-bold text-primary-dark">
                  {data.name.charAt(0).toLocaleUpperCase()}
                </span>
              )}
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-control bg-primary px-4 font-semibold text-white hover:bg-primary-dark">
                  {photoBusy ? 'Subiendo…' : data.profilePhotoUrl ? 'Cambiar foto' : 'Subir foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={changePhoto}
                    aria-label="Subir foto de perfil"
                  />
                </label>
                {data.profilePhotoUrl && (
                  <Button variant="secondary" disabled={photoBusy} onClick={clearPhoto}>Quitar foto</Button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">JPG, PNG o WebP; máximo 5 MB.</p>
          </section>

          <form onSubmit={save} className="mt-6 rounded-card border border-line bg-white p-5 sm:p-7">
            <h2 className="font-display text-xl font-bold">Información personal</h2>
            <div className="mt-5 flex flex-col gap-5">
              <Input label="Nombre" name="name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={data.name} />
              <Input label="Correo electrónico" type="email" value={data.email} disabled hint="El correo no se puede cambiar desde esta pantalla." />
              <Input label="Teléfono" name="phone" type="tel" autoComplete="tel" maxLength={20} defaultValue={data.phone ?? ''} hint="Ejemplo: +56 9 1234 5678" />
              <Textarea label="Sobre mí" name="bio" maxLength={500} defaultValue={data.bio ?? ''} hint="Máximo 500 caracteres." />
              {message && <p role="status" className="text-sm font-semibold text-primary-dark">{message}</p>}
              {error && <p role="alert" className="text-sm font-semibold text-accent-ink">{error}</p>}
              <div>
                <Button type="submit" loading={saving}>Guardar cambios</Button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

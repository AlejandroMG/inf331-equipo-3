import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { ApiError } from '../../lib/http'
import { MAX_PHOTO_MB, MAX_PHOTOS, moveItem, selectPhotos } from './photo-rules'
import { deletePhoto, reorderPhotos, uploadPhoto } from './spaces-api'
import type { OwnerPhoto } from './types'

interface PhotosStepProps {
  spaceId: string
  photos: OwnerPhoto[]
  /** Se llama con la lista nueva cada vez que cambia (después de cada foto subida, ordenada o borrada). */
  onChange: (photos: OwnerPhoto[]) => void
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.')

/** Paso "Fotos": subir de 1 a 10, ordenar (la primera es la portada) y borrar. */
export function PhotosStep({ spaceId, photos, onChange }: PhotosStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [toDelete, setToDelete] = useState<OwnerPhoto | null>(null)

  const full = photos.length >= MAX_PHOTOS

  async function addFiles(list: FileList | null) {
    const { accepted, problems: found } = selectPhotos(Array.from(list ?? []), photos.length)
    // Para poder elegir de nuevo el mismo archivo después de un error.
    if (inputRef.current) inputRef.current.value = ''
    const messages = [...found]
    let current = photos

    for (const [index, file] of accepted.entries()) {
      setBusy(`Subiendo foto ${index + 1} de ${accepted.length}…`)
      try {
        current = [...current, await uploadPhoto(spaceId, file)]
        onChange(current)
      } catch (error) {
        messages.push(`${file.name}: ${messageOf(error)}`)
        // Con 409 el espacio ya está lleno: no tiene sentido seguir intentando con las demás.
        if (error instanceof ApiError && error.status === 409) break
      }
    }
    setBusy(null)
    setProblems(messages)
  }

  async function reorder(ids: string[]) {
    setBusy('Guardando el orden…')
    setProblems([])
    try {
      onChange(await reorderPhotos(spaceId, ids))
    } catch (error) {
      setProblems([messageOf(error)])
    } finally {
      setBusy(null)
    }
  }

  async function confirmDelete() {
    const photo = toDelete
    if (!photo) return
    setToDelete(null)
    setBusy('Borrando la foto…')
    setProblems([])
    try {
      await deletePhoto(spaceId, photo.id)
      // Las que venían después suben un lugar, igual que en el servidor.
      onChange(photos.filter((p) => p.id !== photo.id).map((p, position) => ({ ...p, position })))
    } catch (error) {
      setProblems([messageOf(error)])
    } finally {
      setBusy(null)
    }
  }

  const ids = photos.map((p) => p.id)

  return (
    <>
      <h2 className="font-display text-2xl font-bold">Fotos</h2>
      <p className="text-[15px] text-muted">
        Sube de 1 a {MAX_PHOTOS} fotos (JPG, PNG o WebP, hasta {MAX_PHOTO_MB} MB cada una). La primera es la portada.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-card border-2 border-dashed border-line bg-surface p-5">
        <input
          ref={inputRef}
          id="photo-input"
          aria-label="Elegir fotos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={full || busy !== null}>
          Agregar fotos
        </Button>
        <span className="text-sm text-muted">
          {photos.length} de {MAX_PHOTOS} fotos
        </span>
      </div>

      <div aria-live="polite" className="text-sm font-semibold text-primary">
        {busy}
      </div>
      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-card border border-accent bg-accent-soft p-4 text-[15px] font-semibold text-accent-ink">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-2">
              <div className="relative h-32 overflow-hidden rounded-xl bg-primary-soft">
                <img src={photo.url} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
                    Portada
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-11 px-2.5"
                  aria-label={`Mover foto ${index + 1} a la izquierda`}
                  disabled={index === 0 || busy !== null}
                  onClick={() => void reorder(moveItem(ids, index, index - 1))}
                >
                  ←
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-w-11 px-2.5"
                  aria-label={`Mover foto ${index + 1} a la derecha`}
                  disabled={index === photos.length - 1 || busy !== null}
                  onClick={() => void reorder(moveItem(ids, index, index + 1))}
                >
                  →
                </Button>
                {index > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-3 text-sm"
                    aria-label={`Hacer portada la foto ${index + 1}`}
                    disabled={busy !== null}
                    onClick={() => void reorder(moveItem(ids, index, 0))}
                  >
                    Hacer portada
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-3 text-sm"
                  aria-label={`Eliminar foto ${index + 1}`}
                  disabled={busy !== null}
                  onClick={() => setToDelete(photo)}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Eliminar esta foto?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmDelete()}>Eliminar</Button>
          </>
        }
      >
        {toDelete && <img src={toDelete.url} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />}
        Se borra de tu espacio. Si era la portada, la siguiente pasa a serlo.
      </Modal>
    </>
  )
}

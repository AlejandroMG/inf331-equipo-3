import { useState } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useToast } from '../../components/toast-context'
import { useRequest } from '../../lib/useRequest'
import { AdminNav } from './AdminNav'
import { createSpaceType, fetchAdminSpaceTypes, renameSpaceType } from './moderation-api'
import { MAX_TYPE_NAME, MIN_TYPE_NAME, type AdminSpaceType } from './types'

/** El nombre sin espacios de más, como lo guarda la API. */
const clean = (name: string) => name.trim().replace(/\s+/g, ' ')

function nameError(name: string): string | undefined {
  const text = clean(name)
  if (text.length < MIN_TYPE_NAME || text.length > MAX_TYPE_NAME) return `El nombre debe tener de ${MIN_TYPE_NAME} a ${MAX_TYPE_NAME} caracteres.`
  return undefined
}

function TypeRow({ type, onRename }: { type: AdminSpaceType; onRename: (type: AdminSpaceType, name: string) => Promise<string | undefined> }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(type.name)
  const [error, setError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  async function save() {
    const invalid = nameError(name)
    if (invalid) return setError(invalid)
    setPending(true)
    const failure = await onRename(type, clean(name))
    setPending(false)
    if (failure) setError(failure)
    else setEditing(false)
  }

  return (
    <li className="flex flex-wrap items-start gap-4 rounded-card border border-line bg-white p-4">
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="flex min-w-0 flex-[1_1_320px] flex-wrap items-start gap-2"
        >
          <div className="min-w-48 flex-1">
            <Input
              label={`Nuevo nombre de «${type.name}»`}
              value={name}
              maxLength={MAX_TYPE_NAME}
              onChange={(event) => {
                setName(event.target.value)
                setError(undefined)
              }}
              error={error}
              autoFocus
            />
          </div>
          <Button type="submit" size="sm" loading={pending} className="mt-[30px]">
            Guardar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditing(false)
              setName(type.name)
              setError(undefined)
            }}
            className="mt-[30px]"
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-[1_1_240px]">
            <h2 className="font-display text-lg font-bold">{type.name}</h2>
            <p className="text-sm text-muted">{type.spaces === 1 ? '1 espacio' : `${type.spaces} espacios`}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={`Renombrar ${type.name}`}>
            Renombrar
          </Button>
        </>
      )}
    </li>
  )
}

/** Tipos de espacio (AD-02): ver cuántos espacios usa cada uno, crear tipos nuevos y renombrarlos. */
export function AdminSpaceTypesPage() {
  const toast = useToast()
  const { data, error, loading, retry } = useRequest('admin-space-types', fetchAdminSpaceTypes)
  // Lo que se creó o renombró desde esta pantalla; se suma a la lista cargada sin volver a pedirla.
  const [created, setCreated] = useState<AdminSpaceType[]>([])
  const [renamed, setRenamed] = useState<Record<number, string>>({})
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)

  const types = data ? [...data, ...created].map((type) => ({ ...type, name: renamed[type.id] ?? type.name })) : undefined

  async function create() {
    const invalid = nameError(newName)
    if (invalid) return setNewError(invalid)
    setCreating(true)
    try {
      const type = await createSpaceType(clean(newName))
      setCreated((current) => [...current, type])
      setNewName('')
      toast.show(`Se agregó el tipo «${type.name}».`)
    } catch (failure) {
      setNewError(failure instanceof Error ? failure.message : 'No pudimos agregar el tipo. Intenta de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  async function rename(type: AdminSpaceType, name: string): Promise<string | undefined> {
    try {
      const result = await renameSpaceType(type.id, name)
      setRenamed((current) => ({ ...current, [result.id]: result.name }))
      toast.show(`«${type.name}» ahora se llama «${result.name}».`)
      return undefined
    } catch (failure) {
      return failure instanceof Error ? failure.message : 'No pudimos renombrar el tipo. Intenta de nuevo.'
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Tipos de espacio</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">
        Los tipos que se pueden elegir al publicar y al filtrar el catálogo. No se permiten alojamientos.
      </p>
      <AdminNav />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
        aria-label="Agregar un tipo"
        className="mb-8 flex flex-wrap items-start gap-2"
      >
        <div className="min-w-60 flex-1 sm:max-w-md">
          <Input
            label="Nombre del nuevo tipo"
            value={newName}
            maxLength={MAX_TYPE_NAME}
            onChange={(event) => {
              setNewName(event.target.value)
              setNewError(undefined)
            }}
            error={newError}
            placeholder="Estudio de danza"
          />
        </div>
        <Button type="submit" loading={creating} className="mt-[30px]">
          Agregar tipo
        </Button>
      </form>

      {loading && (
        <p role="status" aria-label="Cargando tipos" className="text-muted">
          Cargando tipos…
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar los tipos.</p>
          <p className="text-sm">{error.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {types && (
        <ul className="flex flex-col gap-3.5">
          {types.map((type) => (
            <TypeRow key={`${type.id}:${type.name}`} type={type} onRename={rename} />
          ))}
        </ul>
      )}
    </div>
  )
}

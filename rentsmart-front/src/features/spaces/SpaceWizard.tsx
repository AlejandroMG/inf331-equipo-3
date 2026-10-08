import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { Card } from '../../components/Card'
import { CheckIcon } from '../../components/icons'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import { paths } from '../../lib/paths'
import { WeeklySchedule } from '../bookings/WeeklySchedule'
import { emptyForm, missingFromError, publishChecklist, REQUIREMENTS, toForm, toPayload, validate, type FormErrors, type MissingField } from './form'
import { LocationField } from './LocationField'
import { PhotosStep } from './PhotosStep'
import { createSpace, publishSpace, updateSpace } from './spaces-api'
import type { OwnerPhoto, OwnerSpace, ReferenceItem, SpaceForm } from './types'

const STEPS = ['Información', 'Ubicación', 'Precio y horario', 'Fotos', 'Revisar'] as const

const toOptions = (items: ReferenceItem[]) => items.map((item) => ({ value: String(item.id), label: item.name }))

export interface SpaceWizardProps {
  types: ReferenceItem[]
  amenities: ReferenceItem[]
  /** Región fija: por ahora solo se publica en la Región Metropolitana. */
  region: ReferenceItem | null
  communes: ReferenceItem[]
  /** Borrador que se continúa; null para uno nuevo. */
  initialSpace: OwnerSpace | null
}

/** Formulario por pasos para publicar un espacio. Guarda el borrador cada vez que se cambia de paso. */
export function SpaceWizard({ types, amenities, region, communes, initialSpace }: SpaceWizardProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<SpaceForm>(() => (initialSpace ? toForm(initialSpace) : emptyForm))
  const [spaceId, setSpaceId] = useState<string | null>(initialSpace?.id ?? null)
  // Las fotos se suben, ordenan y borran en el servidor apenas se hace: no pasan por el guardado del borrador.
  const [photos, setPhotos] = useState<OwnerPhoto[]>(initialSpace?.photos ?? [])
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<FormErrors>({})
  // Tras un intento de guardar con errores, el foco pasa al primer campo inválido (el lector de pantalla lo anuncia con su mensaje).
  const focusFirstError = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusFirstError.current) return
    focusFirstError.current = false
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(initialSpace !== null)
  const [dirty, setDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)
  // Lo que el servidor dijo que falta al intentar publicar; null si no se ha intentado.
  const [missing, setMissing] = useState<MissingField[] | null>(null)
  const [published, setPublished] = useState<OwnerSpace | null>(null)
  const status = published?.status ?? initialSpace?.status ?? 'DRAFT'

  function change<K extends keyof SpaceForm>(key: K, value: SpaceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  function toggleAmenity(id: number) {
    change('amenityIds', form.amenityIds.includes(id) ? form.amenityIds.filter((x) => x !== id) : [...form.amenityIds, id])
  }

  /** Guarda el borrador. Devuelve el id del espacio, o null si hay datos inválidos o el servidor lo rechaza. */
  async function save(): Promise<string | null> {
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      focusFirstError.current = true
      return null
    }

    setSaving(true)
    setSaveError(null)
    try {
      const payload = toPayload(form, region?.id ?? null)
      let id = spaceId
      if (id) {
        await updateSpace(id, payload)
      } else {
        const created = await createSpace(payload)
        id = created.id
        setSpaceId(created.id)
        // Misma ruta con parámetro opcional: la URL guarda el borrador sin recargar el formulario.
        navigate(paths.publishDraft(created.id), { replace: true, state: { created: true } })
      }
      setDirty(false)
      setSaved(true)
      setMissing(null)
      return id
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No pudimos guardar el borrador.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function goTo(next: number) {
    if (next === step) return
    // Hasta que el nombre no esté, no hay borrador que guardar ni a dónde avanzar.
    if ((dirty || spaceId === null) && !(await save())) return
    setStep(next)
  }

  /** Publica el borrador: primero guarda lo pendiente y después pide publicar; si falta algo, lo muestra. */
  async function publish() {
    setSaveError(null)
    const id = dirty || !spaceId ? await save() : spaceId
    if (!id) return

    setPublishing(true)
    try {
      setPublished(await publishSpace(id))
      setMissing(null)
    } catch (error) {
      const found = missingFromError(error)
      if (found) setMissing(found)
      else setSaveError(error instanceof Error ? error.message : 'No pudimos publicar el espacio.')
    } finally {
      setPublishing(false)
    }
  }

  const checklist = publishChecklist(form, photos.length)
  const typeName = types.find((t) => String(t.id) === form.typeId)?.name
  const communeName = communes.find((c) => String(c.id) === form.communeId)?.name
  const priceText = [
    form.pricePerHour && Number(form.pricePerHour) > 0 ? `${formatClp(Number(form.pricePerHour))} / hora` : '',
    form.pricePerDay && Number(form.pricePerDay) > 0 ? `${formatClp(Number(form.pricePerDay))} / día` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const summary: Array<[string, string]> = [
    ['Nombre', form.name.trim()],
    ['Tipo', typeName ?? ''],
    ['Comuna', communeName ?? ''],
    ['Dirección', form.address.trim()],
    ['Capacidad', Number(form.capacity) > 0 ? `${form.capacity} personas` : ''],
    ['Precio', priceText],
    ['Equipamiento', amenities.filter((a) => form.amenityIds.includes(a.id)).map((a) => a.name).join(', ')],
    ['Fotos', photos.length > 0 ? `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}` : ''],
  ]

  if (published) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10">
        <Card className="flex flex-col items-start gap-4 sm:p-8">
          <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-primary-soft text-primary">
            <CheckIcon width={28} height={28} strokeWidth={2.4} />
          </span>
          <h1 role="status" className="font-display text-3xl font-bold">
            ¡Tu espacio está publicado!
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted">
            “{published.name}” ya aparece en el catálogo y puede recibir reservas. Puedes desactivarlo cuando quieras desde Mis espacios; las reservas confirmadas se mantienen.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <LinkButton to={paths.space(published.id)}>Ver en el catálogo</LinkButton>
            <LinkButton to={paths.ownerSpaces} variant="secondary">
              Ir a mis espacios
            </LinkButton>
            <LinkButton to={paths.publish} variant="secondary">
              Publicar otro espacio
            </LinkButton>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-[40px]">
        {status === 'DRAFT' ? 'Publica tu espacio' : 'Edita tu espacio'}
      </h1>
      <p className="mt-2 flex items-center gap-2 text-[15px] text-muted" aria-live="polite">
        {saving ? (
          'Guardando…'
        ) : saved ? (
          <>
            <CheckIcon width={18} height={18} className="text-primary" />
            {status === 'DRAFT' ? 'Borrador guardado' : 'Cambios guardados'}
          </>
        ) : (
          'Tu avance se guarda como borrador en cada paso.'
        )}
      </p>

      <ol aria-label="Pasos" className="my-6 flex flex-wrap gap-2">
        {STEPS.map((label, index) => {
          const n = index + 1
          const current = n === step
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => void goTo(n)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border py-0 pl-1.5 pr-3 text-sm font-semibold',
                  current ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-[30px] items-center justify-center rounded-full font-bold',
                    current ? 'bg-primary text-white' : n < step ? 'bg-primary-soft text-primary-dark' : 'bg-surface text-muted',
                  )}
                >
                  {n}
                </span>
                <span className={current ? 'inline' : 'hidden sm:inline'}>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 sm:p-8">
          <p className="text-sm font-bold text-primary">
            Paso {step} de {STEPS.length} · {STEPS[step - 1]}
          </p>

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold">Cuéntanos sobre tu espacio</h2>
              <Input
                label="Nombre del espacio"
                value={form.name}
                onChange={(e) => change('name', e.target.value)}
                error={errors.name}
                placeholder="Ej.: Sala de reuniones Alameda"
              />
              <Select
                label="Tipo de espacio"
                value={form.typeId}
                onChange={(e) => change('typeId', e.target.value)}
                options={toOptions(types)}
                placeholder="Selecciona un tipo"
                hint="No se permiten alojamientos (casas, cabañas, habitaciones)."
              />
              <Textarea
                label="Descripción"
                value={form.description}
                onChange={(e) => change('description', e.target.value)}
                placeholder="Cuenta qué ofrece, para qué sirve y cómo llegar."
              />
              <Input
                label="Capacidad (personas)"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => change('capacity', e.target.value)}
                error={errors.capacity}
                placeholder="10"
                className="max-w-60"
              />
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[15px] font-semibold">Equipamiento</legend>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((amenity) => {
                    const selected = form.amenityIds.includes(amenity.id)
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        aria-pressed={selected}
                        className={cn(
                          'min-h-11 rounded-full border px-4 text-[15px] font-semibold',
                          selected ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink',
                        )}
                      >
                        {amenity.name}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <Textarea
                label="Reglas del espacio (opcional)"
                value={form.rules}
                onChange={(e) => change('rules', e.target.value)}
                placeholder="Ej.: No se permite fumar."
              />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold">¿Dónde está?</h2>
              <Select
                label="Región"
                value={region ? String(region.id) : ''}
                options={region ? toOptions([region]) : []}
                disabled
                hint="Por ahora solo se publica en la Región Metropolitana."
                onChange={() => undefined}
              />
              <Select
                label="Comuna"
                value={form.communeId}
                onChange={(e) => change('communeId', e.target.value)}
                options={toOptions(communes)}
                placeholder="Selecciona una comuna"
              />
              <Input
                label="Dirección pública"
                value={form.address}
                onChange={(e) => change('address', e.target.value)}
                placeholder="Calle y número"
                hint="Es la que ven todos en el catálogo."
              />
              <Input
                label="Detalle de la dirección (privado)"
                value={form.addressDetail}
                onChange={(e) => change('addressDetail', e.target.value)}
                placeholder="Piso, oficina o indicaciones"
                hint="Solo lo ve quien tenga una reserva confirmada."
              />
              <LocationField
                latitude={form.latitude}
                longitude={form.longitude}
                errors={errors}
                onChange={(field, value) => change(field, value)}
              />
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-display text-2xl font-bold">Precio y horario</h2>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-48 flex-1">
                  <Input
                    label="Precio por hora (CLP)"
                    type="number"
                    min={1}
                    value={form.pricePerHour}
                    onChange={(e) => change('pricePerHour', e.target.value)}
                    error={errors.pricePerHour}
                    placeholder="12000"
                  />
                </div>
                <div className="min-w-48 flex-1">
                  <Input
                    label="Precio por día (CLP, opcional)"
                    type="number"
                    min={1}
                    value={form.pricePerDay}
                    onChange={(e) => change('pricePerDay', e.target.value)}
                    error={errors.pricePerDay}
                    placeholder="90000"
                  />
                </div>
              </div>
              <p className="-mt-2 text-[13px] text-muted">
                Ingresa al menos uno. Si cambias el precio después, solo aplica a reservas nuevas.
              </p>
              {/* DI-01, del equipo de reservas: carga y guarda el horario por su cuenta, con su propio botón. */}
              {spaceId && <WeeklySchedule spaceId={spaceId} />}
            </>
          )}

          {step === 4 && spaceId && <PhotosStep spaceId={spaceId} photos={photos} onChange={setPhotos} />}

          {step === 5 && (
            <>
              <h2 className="font-display text-2xl font-bold">Revisa y publica</h2>
              <dl className="grid grid-cols-[minmax(110px,170px)_1fr] gap-x-4 gap-y-2.5 text-[15px]">
                {summary.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="font-semibold text-muted">{label}</dt>
                    <dd className={value ? '' : 'font-semibold text-accent-ink'}>{value || 'Falta'}</dd>
                  </div>
                ))}
              </dl>
              {missing && missing.length > 0 && (
                <div role="alert" className="rounded-card bg-accent-soft p-4 text-[15px] text-accent-ink">
                  <strong className="mb-2 block">Aún no puedes publicar. Te falta:</strong>
                  <ul className="flex flex-col gap-1 pl-5">
                    {missing.map((code) => (
                      <li key={code} className="list-disc">
                        {REQUIREMENTS[code].label}
                        {code === 'schedule' ? (
                          <span> (se podrá cargar pronto)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void goTo(REQUIREMENTS[code].step)}
                            className="ml-2 font-bold underline"
                          >
                            Ir al paso {REQUIREMENTS[code].step}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {status === 'DRAFT' ? (
                <div>
                  <Button onClick={() => void publish()} loading={publishing}>
                    Publicar espacio
                  </Button>
                </div>
              ) : (
                <div className="rounded-card bg-primary-soft p-4 text-[15px] text-primary-dark">
                  {status === 'ACTIVE'
                    ? 'Este espacio ya está publicado. Tus cambios se guardan al pasar de paso.'
                    : status === 'INACTIVE'
                      ? 'Este espacio está desactivado: actívalo desde Mis espacios para que vuelva al catálogo.'
                      : 'Un administrador bloqueó esta publicación.'}
                </div>
              )}
            </>
          )}

          {saveError && (
            <div role="alert" className="rounded-card border border-accent bg-accent-soft p-4 text-[15px] font-semibold text-accent-ink">
              {saveError}
            </div>
          )}

          <div className="mt-2 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => void goTo(step - 1)} disabled={step === 1 || saving}>
              Atrás
            </Button>
            {step < STEPS.length && (
              <Button onClick={() => void goTo(step + 1)} loading={saving}>
                Siguiente
              </Button>
            )}
          </div>
        </Card>

        <aside aria-label="Estado del borrador" className="flex max-w-[360px] flex-[1_1_280px] flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="font-display text-xl font-bold">Para publicar necesitas</h2>
          <ul className="flex flex-col gap-2.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-[15px]">
                <span
                  className={cn(
                    'inline-flex size-[22px] shrink-0 items-center justify-center rounded-full',
                    item.done ? 'bg-primary text-white' : 'border-2 border-line bg-white',
                  )}
                >
                  {item.done && <CheckIcon width={14} height={14} strokeWidth={3.2} />}
                </span>
                <span className={item.done ? 'text-muted' : 'font-semibold'}>{item.label}</span>
                <span className="sr-only">{item.done ? 'Listo' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Mientras falte algo, tu espacio queda como borrador y no aparece en el catálogo.
          </p>
        </aside>
      </div>
    </div>
  )
}

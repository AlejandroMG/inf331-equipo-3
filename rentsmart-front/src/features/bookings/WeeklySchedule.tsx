import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { useRequest } from '../../lib/useRequest'
import { fetchSchedule, saveSchedule } from './schedule-api'
import { dayError, DEFAULT_RANGE, END_TIMES, nextRange, START_TIMES, toRules, toWeek, WEEK_DAYS, type TimeRange, type WeekForm } from './schedule-form'
import type { Schedule } from './types'

interface WeeklyScheduleProps {
  /** El espacio propio cuyo horario se edita; sirve también para un borrador. */
  spaceId: string
  /** Se llama con el horario ya guardado, por ejemplo para marcar el requisito como cumplido. */
  onSaved?: (schedule: Schedule) => void
}

const options = (times: string[]) => times.map((time) => ({ value: time, label: time }))
const START_OPTIONS = options(START_TIMES)
const END_OPTIONS = options(END_TIMES)

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.')

/**
 * Horario semanal de un espacio (DI-01): qué días se arrienda y en qué rangos, en horas cerradas y hora de
 * Chile. Carga el horario del espacio y lo guarda completo con su propio botón.
 */
export function WeeklySchedule({ spaceId, onSaved }: WeeklyScheduleProps) {
  const id = useId()
  const rootRef = useRef<HTMLElement>(null)
  const { data, error: loadError, loading, retry } = useRequest(spaceId, (signal) => fetchSchedule(spaceId, signal))
  // Lo que se edita; null hasta que llega el horario guardado.
  const [draft, setDraft] = useState<{ spaceId: string; week: WeekForm } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Tras un intento de guardar con errores, el foco pasa al primer campo inválido.
  const focusFirstError = useRef(false)
  useEffect(() => {
    if (!focusFirstError.current) return
    focusFirstError.current = false
    rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })

  const week = draft?.spaceId === spaceId ? draft.week : data ? toWeek(data.rules) : null

  function change(weekday: number, ranges: TimeRange[]) {
    if (!week) return
    setDraft({ spaceId, week: { ...week, [weekday]: ranges } })
    setDirty(true)
    setSavedOnce(false)
    setSaveError(null)
  }

  async function save() {
    if (!week) return
    if (WEEK_DAYS.some((day) => dayError(week[day.weekday]))) {
      setSaveError('Corrige los rangos marcados antes de guardar.')
      focusFirstError.current = true
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await saveSchedule(spaceId, toRules(week))
      setDraft({ spaceId, week: toWeek(saved.rules) })
      setDirty(false)
      setSavedOnce(true)
      onSaved?.(saved)
    } catch (error) {
      setSaveError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section ref={rootRef} aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div>
        <h3 id={`${id}-title`} className="font-display text-xl font-bold">
          Horario semanal
        </h3>
        <p className="mt-1 text-[15px] text-muted">
          Marca los días en que se arrienda tu espacio y sus horas. Se reserva en bloques de 1 hora, en hora de Chile.
        </p>
      </div>

      {loading && <p role="status" className="text-[15px] text-muted">Cargando horario…</p>}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-accent-soft p-4 text-[15px] text-accent-ink">
          <span>No pudimos cargar el horario. {loadError.message}</span>
          <Button variant="secondary" size="sm" onClick={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {week && (
        <>
          <div className="flex flex-col divide-y divide-line rounded-card border border-line">
            {WEEK_DAYS.map(({ weekday, name }) => {
              const ranges = week[weekday]
              const error = dayError(ranges)
              const errorId = `${id}-error-${weekday}`
              const toAdd = nextRange(ranges)
              return (
                <div key={weekday} role="group" aria-labelledby={`${id}-day-${weekday}`} className="flex flex-col gap-3 p-3 sm:p-4">
                  <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-base font-semibold">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={ranges.length > 0}
                      onChange={(event) => change(weekday, event.target.checked ? [DEFAULT_RANGE] : [])}
                    />
                    <span id={`${id}-day-${weekday}`}>{name}</span>
                    {ranges.length === 0 && <span className="text-[15px] font-normal text-muted">No se arrienda</span>}
                  </label>

                  {ranges.map((range, index) => {
                    const update = (patch: Partial<TimeRange>) =>
                      change(weekday, ranges.map((item, i) => (i === index ? { ...item, ...patch } : item)))
                    const invalid = error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}
                    return (
                      <div key={index} className="flex flex-wrap items-end gap-3">
                        <div className="w-28">
                          <Select
                            label="Desde"
                            aria-label={`${name}, rango ${index + 1}, desde`}
                            value={range.startTime}
                            options={START_OPTIONS}
                            onChange={(event) => update({ startTime: event.target.value })}
                            {...invalid}
                          />
                        </div>
                        <div className="w-28">
                          <Select
                            label="Hasta"
                            aria-label={`${name}, rango ${index + 1}, hasta`}
                            value={range.endTime}
                            options={END_OPTIONS}
                            onChange={(event) => update({ endTime: event.target.value })}
                            {...invalid}
                          />
                        </div>
                        {ranges.length > 1 && (
                          <Button
                            variant="link"
                            aria-label={`Quitar el rango ${index + 1} del ${name.toLowerCase()}`}
                            onClick={() => change(weekday, ranges.filter((_, i) => i !== index))}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                    )
                  })}

                  {error && (
                    <p id={errorId} className="text-[13px] font-semibold text-accent-ink">
                      {error}
                    </p>
                  )}

                  {ranges.length > 0 && toAdd && (
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Agregar otro rango el ${name.toLowerCase()}`}
                        onClick={() => change(weekday, [...ranges, toAdd])}
                      >
                        Agregar otro rango
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {saveError && (
            <div role="alert" className="rounded-card border border-accent bg-accent-soft p-4 text-[15px] font-semibold text-accent-ink">
              {saveError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} loading={saving}>
              Guardar horario
            </Button>
            <p role="status" className="text-[15px] text-muted">
              {savedOnce ? 'Horario guardado.' : dirty ? 'Tienes cambios sin guardar.' : ''}
            </p>
          </div>
        </>
      )}
    </section>
  )
}

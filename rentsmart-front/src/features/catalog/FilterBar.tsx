import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import type { ReferenceItem } from '../spaces/types'
import { hasFilters, type CatalogFilters, type PriceUnit } from './filters'

const CAPACITIES = [4, 8, 15, 40]
// Los precios por día están en otra escala que los de la hora, así que cada unidad tiene sus propias opciones.
const PRICES: Record<PriceUnit, number[]> = {
  hour: [5000, 10000, 15000, 20000, 30000],
  day: [30000, 50000, 80000, 120000, 200000],
}
const UNITS: Array<{ value: PriceUnit; label: string; per: string }> = [
  { value: 'hour', label: 'Por hora', per: 'hora' },
  { value: 'day', label: 'Por día', per: 'día' },
]

/** Las opciones fijas más los valores de la URL que no sean una de ellas, para que el selector los muestre. */
function withCurrent(base: number[], ...current: Array<number | null>): number[] {
  const extra = current.filter((n): n is number => n !== null && !base.includes(n))
  return extra.length === 0 ? base : [...base, ...extra].sort((a, b) => a - b)
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-4 text-[15px] font-semibold',
        pressed ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink',
      )}
    >
      {children}
    </button>
  )
}

interface FilterSelectProps {
  label: string
  placeholder: string
  value: number | null
  options: Array<{ value: number; label: string; disabled?: boolean }>
  onChange: (value: number | null) => void
}

// La etiqueta es solo para lectores de pantalla: a la vista, la primera opción dice de qué es el filtro.
function FilterSelect({ label, placeholder, value, options, onChange }: FilterSelectProps) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="min-h-11 rounded-control border border-line bg-white px-3 text-[15px] text-ink"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface FilterBarProps {
  /** Tipos y comunas; mientras no llegan (o si fallan) se muestran solo los filtros que no los necesitan. */
  options: { types: ReferenceItem[]; communes: ReferenceItem[] } | undefined
  filters: CatalogFilters
  onChange: (changes: Partial<CatalogFilters>) => void
  onClear: () => void
}

/**
 * Chips de tipo y selectores de comuna, capacidad y precio (por hora o por día, desde y hasta).
 * Cada cambio se aplica al instante.
 */
export function FilterBar({ options, filters, onChange, onClear }: FilterBarProps) {
  const unit = UNITS.find((u) => u.value === filters.priceUnit) ?? UNITS[0]
  const prices = withCurrent(PRICES[filters.priceUnit], filters.minPrice, filters.maxPrice)

  return (
    <div>
      {options && options.types.length > 0 && (
        <div role="group" aria-label="Tipo de espacio" className="flex flex-wrap gap-2">
          <Chip pressed={filters.typeId === null} onClick={() => onChange({ typeId: null })}>
            Todos
          </Chip>
          {options.types.map((type) => (
            <Chip key={type.id} pressed={filters.typeId === type.id} onClick={() => onChange({ typeId: type.id })}>
              {type.name}
            </Chip>
          ))}
        </div>
      )}

      <div className={cn('flex flex-wrap items-center gap-3', options && options.types.length > 0 && 'mt-4')}>
        {options && options.communes.length > 0 && (
          <FilterSelect
            label="Comuna"
            placeholder="Todas las comunas"
            value={filters.communeId}
            options={options.communes.map((commune) => ({ value: commune.id, label: commune.name }))}
            onChange={(communeId) => onChange({ communeId })}
          />
        )}
        <FilterSelect
          label="Capacidad mínima"
          placeholder="Cualquier capacidad"
          value={filters.minCapacity}
          options={withCurrent(CAPACITIES, filters.minCapacity).map((n) => ({ value: n, label: `${n} o más personas` }))}
          onChange={(minCapacity) => onChange({ minCapacity })}
        />

        <div role="group" aria-label="Precio" className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Unidad del precio" className="inline-flex overflow-hidden rounded-control border border-line">
            {UNITS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.priceUnit === option.value}
                // Los precios por hora y por día no se parecen: al cambiar de unidad se empieza de nuevo.
                onClick={() => option.value !== filters.priceUnit && onChange({ priceUnit: option.value, minPrice: null, maxPrice: null })}
                className={cn(
                  'min-h-11 px-3.5 text-[15px] font-semibold',
                  filters.priceUnit === option.value ? 'bg-primary text-white' : 'bg-white text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Una opción que dejaría el rango al revés (mínimo sobre el máximo) no se puede elegir. */}
          <FilterSelect
            label="Precio mínimo"
            placeholder="Precio mínimo"
            value={filters.minPrice}
            options={prices.map((n) => ({
              value: n,
              label: `Desde ${formatClp(n)} / ${unit.per}`,
              disabled: filters.maxPrice !== null && n > filters.maxPrice,
            }))}
            onChange={(minPrice) => onChange({ minPrice })}
          />
          <FilterSelect
            label="Precio máximo"
            placeholder="Precio máximo"
            value={filters.maxPrice}
            options={prices.map((n) => ({
              value: n,
              label: `Hasta ${formatClp(n)} / ${unit.per}`,
              disabled: filters.minPrice !== null && n < filters.minPrice,
            }))}
            onChange={(maxPrice) => onChange({ maxPrice })}
          />
        </div>

        {hasFilters(filters) && (
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-[15px] font-semibold text-primary underline">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}

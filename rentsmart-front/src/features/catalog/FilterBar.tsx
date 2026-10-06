import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatClp } from '../../lib/format'
import type { ReferenceItem } from '../spaces/types'
import { hasFilters, type CatalogFilters } from './filters'

const CAPACITIES = [4, 8, 15, 40]
const PRICES = [10000, 20000, 30000]

/** Las opciones fijas más el valor de la URL si no es una de ellas, para que el selector lo muestre. */
function withCurrent(base: number[], current: number | null): number[] {
  return current === null || base.includes(current) ? base : [...base, current].sort((a, b) => a - b)
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
  options: Array<{ value: number; label: string }>
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
          <option key={option.value} value={option.value}>
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

/** Chips de tipo y selectores de comuna, capacidad y precio máximo por hora. Cada cambio se aplica al instante. */
export function FilterBar({ options, filters, onChange, onClear }: FilterBarProps) {
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
        <FilterSelect
          label="Precio máximo por hora"
          placeholder="Cualquier precio"
          value={filters.maxPrice}
          options={withCurrent(PRICES, filters.maxPrice).map((n) => ({ value: n, label: `Hasta ${formatClp(n)} / hora` }))}
          onChange={(maxPrice) => onChange({ maxPrice })}
        />
        {hasFilters(filters) && (
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-[15px] font-semibold text-primary underline">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}

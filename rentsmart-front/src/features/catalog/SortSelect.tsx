import { useId } from 'react'
import type { CatalogSort, PriceUnit } from './filters'

interface SortSelectProps {
  value: CatalogSort
  /** El orden por precio sigue la unidad elegida en el filtro de precio (hora o día). */
  priceUnit: PriceUnit
  onChange: (sort: CatalogSort) => void
}

/** "Ordenar por": más recientes, o por precio de menor a mayor o de mayor a menor. */
export function SortSelect({ value, priceUnit, onChange }: SortSelectProps) {
  const id = useId()
  const per = priceUnit === 'day' ? 'día' : 'hora'
  const options: Array<{ value: CatalogSort; label: string }> = [
    { value: 'recent', label: 'Más recientes' },
    { value: 'price_asc', label: `Precio por ${per}: menor a mayor` },
    { value: 'price_desc', label: `Precio por ${per}: mayor a menor` },
  ]

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[15px] text-muted">
        Ordenar por
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as CatalogSort)}
        className="min-h-11 rounded-control border border-line bg-white px-3 text-[15px] text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

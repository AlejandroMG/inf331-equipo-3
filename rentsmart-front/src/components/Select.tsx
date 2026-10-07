import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: Array<{ value: string; label: string }>
  /** Primera opción, sin valor, por ejemplo "Selecciona un tipo". */
  placeholder?: string
  error?: string
  hint?: string
}

export function Select({ label, options, placeholder, error, hint, id, className, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const messageId = `${selectId}-message`
  const message = error ?? hint

  return (
    <div className="flex flex-col">
      <label htmlFor={selectId} className="mb-1.5 text-[15px] font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          'min-h-12 w-full rounded-control bg-white px-3.5 py-2.5 text-base text-ink disabled:bg-surface disabled:text-muted',
          error ? 'border-2 border-accent' : 'border border-field',
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {message && (
        <p id={messageId} className={cn('mt-1.5 text-[13px]', error ? 'font-semibold text-accent-ink' : 'text-muted')}>
          {message}
        </p>
      )}
    </div>
  )
}

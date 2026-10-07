import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Mensaje de error; marca el campo como inválido. */
  error?: string
  /** Ayuda bajo el campo. */
  hint?: string
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const message = error ?? hint

  return (
    <div className="flex flex-col">
      <label htmlFor={inputId} className="mb-1.5 text-[15px] font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          'min-h-12 w-full rounded-control bg-white px-3.5 py-2.5 text-base text-ink disabled:bg-surface disabled:text-muted',
          error ? 'border-2 border-accent' : 'border border-field',
          className,
        )}
        {...rest}
      />
      {message && (
        <p id={messageId} className={cn('mt-1.5 text-[13px]', error ? 'font-semibold text-accent-ink' : 'text-muted')}>
          {message}
        </p>
      )}
    </div>
  )
}

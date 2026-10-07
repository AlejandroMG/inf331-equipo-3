import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const messageId = `${textareaId}-message`
  const message = error ?? hint

  return (
    <div className="flex flex-col">
      <label htmlFor={textareaId} className="mb-1.5 text-[15px] font-semibold">
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          'min-h-28 w-full resize-y rounded-control bg-white px-3.5 py-2.5 text-base text-ink disabled:bg-surface disabled:text-muted',
          error ? 'border-2 border-accent' : 'border border-line',
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

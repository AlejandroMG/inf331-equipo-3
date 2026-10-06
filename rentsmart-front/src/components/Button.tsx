import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes'
import { Spinner } from './icons'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Muestra un indicador y bloquea el botón mientras se espera una respuesta. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner width={18} height={18} />}
      {children}
    </button>
  )
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Enlace de navegación con aspecto de botón. */
export function LinkButton({ variant = 'primary', size = 'md', className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />
}

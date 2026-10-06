import { cn } from '../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'link'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 font-bold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-45'

const variants: Record<ButtonVariant, string> = {
  primary: 'rounded-xl bg-primary text-white hover:bg-primary-dark',
  secondary: 'rounded-xl border border-line bg-white font-semibold text-ink hover:bg-surface',
  outline: 'rounded-xl border-[1.5px] border-primary bg-white text-primary hover:bg-primary-soft',
  link: 'text-primary underline hover:text-primary-dark',
}

// Alto mínimo de 44 px (objetivo táctil) y 48 px en el tamaño normal.
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-12 px-6 text-base',
  sm: 'min-h-11 px-4 text-[15px]',
}

/** Clases de un botón; sirve también para dar aspecto de botón a un <Link>. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], variant === 'link' ? 'min-h-11 px-2' : sizes[size], className)
}

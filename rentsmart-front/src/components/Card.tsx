import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Contenedor con borde y esquinas redondeadas; el relleno se ajusta con className (p-0 para tarjetas con imagen). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-white p-6', className)} {...rest} />
}

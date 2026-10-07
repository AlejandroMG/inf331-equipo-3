import { useId } from 'react'
import { LinkButton } from '../../components/Button'
import { cn } from '../../lib/cn'
import { paths } from '../../lib/paths'
import { metaText, missingText } from './summary'
import type { OwnerSpaceSummary } from './types'

const STATUS: Record<OwnerSpaceSummary['status'], { label: string; badge: string }> = {
  ACTIVE: { label: 'Activo', badge: 'bg-primary-soft text-primary-dark' },
  INACTIVE: { label: 'Inactivo', badge: 'border border-line bg-surface text-muted' },
  DRAFT: { label: 'Borrador', badge: 'bg-accent-soft text-accent-ink' },
  BLOCKED: { label: 'Bloqueado', badge: 'bg-accent text-white' },
}

interface OwnerSpaceRowProps {
  space: OwnerSpaceSummary
  /** Hay un cambio de estado en curso para este espacio. */
  pending: boolean
  /** Se pidió activar o desactivar; el que llama decide si pide confirmación. */
  onToggle: (space: OwnerSpaceSummary) => void
}

/** Un espacio en el panel: portada, estado, lo que le falta y los accesos a editar y a activar o desactivar. */
export function OwnerSpaceRow({ space, pending, onToggle }: OwnerSpaceRowProps) {
  const status = STATUS[space.status]
  const titleId = useId()
  const stateId = useId()
  const on = space.status === 'ACTIVE'
  // Un borrador se publica desde el formulario y uno bloqueado solo lo mueve el administrador.
  const canToggle = space.status === 'ACTIVE' || space.status === 'INACTIVE'

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-white p-4">
      <div className="h-[72px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary-soft to-accent-soft">
        {space.coverUrl && <img src={space.coverUrl} alt="" loading="lazy" className="size-full object-cover" />}
      </div>

      <div className="min-w-0 flex-[1_1_200px]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className="font-display text-lg font-bold">
            {space.name}
          </h3>
          <span className={cn('rounded-full px-2.5 py-[3px] text-[13px] font-bold', status.badge)}>{status.label}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{metaText(space)}</p>
        {space.status === 'BLOCKED' ? (
          <p className="mt-1.5 text-sm font-semibold text-accent-ink">Un administrador bloqueó esta publicación.</p>
        ) : (
          space.missing.length > 0 && (
            <p className="mt-1.5 text-sm font-semibold text-accent-ink">Falta: {missingText(space.missing)}</p>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            // El nombre es el texto que se ve ("Activo") más el del espacio: quien dicta "activo" por voz lo encuentra.
            aria-labelledby={`${stateId} ${titleId}`}
            disabled={pending}
            onClick={() => onToggle(space)}
            className="inline-flex min-h-11 items-center gap-2.5 px-1 text-sm font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
          >
            <span className={cn('relative h-[26px] w-11 rounded-full transition-colors', on ? 'bg-primary' : 'bg-field')}>
              <span className={cn('absolute top-[3px] size-5 rounded-full bg-white transition-all', on ? 'left-[21px]' : 'left-[3px]')} />
            </span>
            <span id={stateId}>{on ? 'Activo' : 'Inactivo'}</span>
          </button>
        )}
        {space.status !== 'BLOCKED' && (
          <LinkButton variant="secondary" size="sm" to={paths.publishDraft(space.id)} aria-label={`${space.status === 'DRAFT' ? 'Completar' : 'Editar'} ${space.name}`}>
            {space.status === 'DRAFT' ? 'Completar' : 'Editar'}
          </LinkButton>
        )}
      </div>
    </li>
  )
}

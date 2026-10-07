import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { ApiError } from '../../lib/http'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { SpaceWizard } from './SpaceWizard'
import { fetchAmenities, fetchCommunes, fetchOwnSpace, fetchRegions, fetchSpaceTypes } from './spaces-api'

async function loadWizardData(spaceId: string | undefined, signal: AbortSignal) {
  const [types, amenities, regions, space] = await Promise.all([
    fetchSpaceTypes(signal),
    fetchAmenities(signal),
    fetchRegions(signal),
    spaceId ? fetchOwnSpace(spaceId, signal) : Promise.resolve(null),
  ])
  // Por ahora solo se publica en una región (la Metropolitana).
  const region = regions[0] ?? null
  const communes = region ? await fetchCommunes(region.id, signal) : []
  return { types, amenities, region, communes, space }
}

export function PublishSpacePage() {
  const { spaceId } = useParams()
  const location = useLocation()
  // El formulario carga el borrador una vez. Al guardar el primer borrador el wizard cambia la URL a
  // /publish/:id (con state.created) y eso no debe recargar ni reiniciar nada; cualquier otra navegación
  // a esta pantalla (otro borrador, "Publicar tu espacio" de nuevo) sí empieza de cero.
  const created = (location.state as { created?: boolean } | null)?.created === true
  const [view, setView] = useState({ seen: location.key, initialId: spaceId, generation: 0 })
  if (location.key !== view.seen) {
    setView(
      created
        ? { ...view, seen: location.key }
        : { seen: location.key, initialId: spaceId, generation: view.generation + 1 },
    )
  }

  const { data, error, loading, retry } = useRequest(`${view.generation}:${view.initialId ?? 'new'}`, (signal) =>
    loadWizardData(view.initialId, signal),
  )
  usePageTitle(view.initialId ? 'Edita tu espacio' : 'Publica tu espacio')

  if (loading) {
    return (
      <div role="status" aria-label="Cargando el formulario" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="h-10 w-1/2 motion-safe:animate-pulse rounded bg-line/60" />
        <div className="mt-6 h-80 motion-safe:animate-pulse rounded-card bg-line/60" />
      </div>
    )
  }

  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-4 px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-bold">No encontramos este borrador</h1>
        <p className="max-w-lg text-muted">No existe o no es tuyo. Puedes empezar uno nuevo.</p>
        <LinkButton to={paths.publish}>Publicar un espacio nuevo</LinkButton>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-accent bg-accent-soft p-6 text-accent-ink">
          <p className="font-semibold">No pudimos cargar el formulario.</p>
          <p className="text-sm">{error?.message}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SpaceWizard
      types={data.types}
      amenities={data.amenities}
      region={data.region}
      communes={data.communes}
      initialSpace={data.space}
    />
  )
}

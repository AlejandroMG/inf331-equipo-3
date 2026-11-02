import { Link, useParams } from 'react-router'
import { Button, LinkButton } from '../../components/Button'
import { ApiError } from '../../lib/http'
import { usePageTitle } from '../../lib/page-title'
import { paths } from '../../lib/paths'
import { useRequest } from '../../lib/useRequest'
import { fetchPublicProfile } from './api'

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function PublicProfilePage() {
  const { userId = '' } = useParams()
  const { data, error, loading, retry } = useRequest(`public-profile:${userId}`, (signal) => fetchPublicProfile(userId, signal))
  usePageTitle(data?.name ?? 'Perfil del anfitrión')

  if (loading) {
    return <p role="status" className="mx-auto max-w-[900px] px-4 py-12 text-muted">Cargando perfil…</p>
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Este perfil no está disponible</h1>
        <p className="mt-2 text-muted">El anfitrión no existe o su cuenta no está activa.</p>
        <LinkButton to={paths.home} className="mt-5">Volver al catálogo</LinkButton>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-[900px] px-4 py-12">
        <h1 className="font-display text-3xl font-bold">No pudimos cargar el perfil.</h1>
        <p className="mt-2 text-muted">{error.message}</p>
        <Button variant="secondary" onClick={retry} className="mt-5">Reintentar</Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
      <Link to={paths.home} className="inline-flex min-h-11 items-center font-semibold text-primary">← Explorar espacios</Link>
      <section className="mt-5 flex flex-col gap-5 rounded-card border border-line bg-white p-6 sm:flex-row sm:items-center sm:p-8">
        {data.profilePhotoUrl ? (
          <img src={data.profilePhotoUrl} alt={`Foto de ${data.name}`} className="size-28 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="inline-flex size-28 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-4xl font-bold text-primary-dark">
            {data.name.charAt(0).toLocaleUpperCase()}
          </span>
        )}
        <div>
          <h1 className="font-display text-3xl font-bold">{data.name}</h1>
          <p className="mt-2 text-sm text-muted">En RentSmart desde {dateFormatter.format(new Date(data.createdAt))}</p>
          {data.bio && <p className="mt-4 whitespace-pre-line leading-relaxed">{data.bio}</p>}
          <p className="mt-4 font-semibold">
            {data.averageRating === null ? 'Sin calificaciones todavía' : `${data.averageRating.toFixed(1)} de 5`}
            <span className="font-normal text-muted"> · {data.reviewCount} {data.reviewCount === 1 ? 'reseña' : 'reseñas'}</span>
          </p>
        </div>
      </section>

      <section aria-labelledby="reviews-title" className="mt-9">
        <h2 id="reviews-title" className="font-display text-2xl font-bold">Reseñas de sus espacios</h2>
        {data.reviews.length === 0 ? (
          <p className="mt-4 rounded-card border border-dashed border-line bg-white p-6 text-muted">Este anfitrión todavía no recibe reseñas.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {data.reviews.map((review) => (
              <li key={review.id} className="rounded-card border border-line bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{review.authorName}</h3>
                  <time dateTime={review.createdAt} className="text-sm text-muted">{dateFormatter.format(new Date(review.createdAt))}</time>
                </div>
                <p className="mt-1 text-sm text-primary-dark" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                <p className="mt-2 text-sm text-muted">Espacio: {review.spaceName}</p>
                {review.comment && <p className="mt-3 whitespace-pre-line">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

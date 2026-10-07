import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'
import { pageTitle } from '../lib/page-title'
import { Footer } from './Footer'
import { Navbar } from './Navbar'

/** Estructura común de todas las páginas: navbar arriba, contenido y footer abajo. */
export function AppLayout() {
  const location = useLocation()
  const matches = useMatches()
  const mainRef = useRef<HTMLElement>(null)
  const lastPath = useRef(location.pathname)
  const routeTitle = (matches.at(-1)?.handle as { title?: string } | undefined)?.title
  // El formulario de publicar cambia la URL al guardar el primer borrador, pero sigue siendo la misma pantalla.
  const savedDraft = (location.state as { created?: boolean } | null)?.created === true

  // El título de la pestaña es el de la ruta; las pantallas con título propio lo ponen después con usePageTitle
  // (un efecto normal corre después de este, así que el de la pantalla gana).
  useLayoutEffect(() => {
    document.title = pageTitle(routeTitle)
  }, [routeTitle])

  // Al pasar a otra pantalla el foco va al contenido. Sin esto queda en el enlace que se acaba de usar, que ya no
  // existe, y quien navega con teclado o lector de pantalla vuelve al principio de la página sin enterarse.
  // Cambiar solo los filtros o la página no es pasar a otra pantalla: ahí el foco se queda donde está.
  useEffect(() => {
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    if (!savedDraft) mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname, savedDraft])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:font-semibold"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      {/* Una pantalla nueva empieza arriba; al volver atrás se recupera donde se estaba. */}
      <ScrollRestoration />
    </div>
  )
}

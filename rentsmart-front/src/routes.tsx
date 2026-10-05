import type { RouteObject } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { PlaceholderPage } from './components/PlaceholderPage'
import { RequireAuth } from './components/RequireAuth'
import { CatalogPage } from './features/catalog/CatalogPage'
import { SpaceDetailPage } from './features/catalog/SpaceDetailPage'
import { ComponentsPage } from './features/dev/ComponentsPage'
import { OwnerSpacesPage } from './features/owner/OwnerSpacesPage'
import { PublishSpacePage } from './features/spaces/PublishSpacePage'

/**
 * Rutas de la app. Cada dominio agrega las suyas aquí y reemplaza el placeholder por su pantalla.
 * Las que están dentro de <RequireAuth /> exigen sesión y, sin ella, redirigen a /login.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: 'spaces/:spaceId', element: <SpaceDetailPage /> },
      // Lo reemplaza A con la pantalla real de inicio de sesión (CU-02).
      { path: 'login', element: <PlaceholderPage title="Iniciar sesión" story="CU-02" /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'publish', element: <PublishSpacePage /> },
          { path: 'owner/spaces', element: <OwnerSpacesPage /> },
        ],
      },
      ...(import.meta.env.DEV ? [{ path: 'dev/componentes', element: <ComponentsPage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

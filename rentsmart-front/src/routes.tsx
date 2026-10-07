import type { RouteObject } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { RequireAuth } from './components/RequireAuth'
import { CatalogPage } from './features/catalog/CatalogPage'
import { SpaceDetailPage } from './features/catalog/SpaceDetailPage'
import { LoginPage } from './features/auth/LoginPage'
import { PlaceholderPage } from './components/PlaceholderPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { RequireRole } from './features/auth/RequireRole'
import { ComponentsPage } from './features/dev/ComponentsPage'
import { FavoritesPage } from './features/favorites/FavoritesPage'
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
      { path: 'login', element: <LoginPage />, handle: { title: 'Iniciar sesión' } },
      { path: 'register', element: <RegisterPage />, handle: { title: 'Crear cuenta' } },
      {
        element: <RequireAuth />,
        children: [
          { path: 'publish/:spaceId?', element: <PublishSpacePage /> },
          { path: 'owner/spaces', element: <OwnerSpacesPage /> },
          { path: 'favorites', element: <FavoritesPage />, handle: { title: 'Mis favoritos' } },
        ],
      },
      {
        element: <RequireRole role="ADMIN" />,
        // Lo reemplaza A con el panel real de administración (AD-01).
        children: [{ path: 'admin', element: <PlaceholderPage title="Administración" story="AD-01" /> }],
      },
      ...(import.meta.env.DEV ? [{ path: 'dev/componentes', element: <ComponentsPage /> }] : []),
      { path: '*', element: <NotFoundPage />, handle: { title: 'Página no encontrada' } },
    ],
  },
]

import type { RouteObject } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { NotFoundPage } from './components/NotFoundPage'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { CatalogPage } from './features/catalog/CatalogPage'
import { SpaceDetailPage } from './features/catalog/SpaceDetailPage'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { ComponentsPage } from './features/dev/ComponentsPage'
import { AdminSpacesPage } from './features/moderation/AdminSpacesPage'
import { AdminSpaceTypesPage } from './features/moderation/AdminSpaceTypesPage'
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
          {
            element: <RequireAdmin />,
            children: [
              { path: 'admin/spaces', element: <AdminSpacesPage /> },
              { path: 'admin/space-types', element: <AdminSpaceTypesPage /> },
            ],
          },
        ],
      },
      ...(import.meta.env.DEV ? [{ path: 'dev/componentes', element: <ComponentsPage /> }] : []),
      { path: '*', element: <NotFoundPage />, handle: { title: 'Página no encontrada' } },
    ],
  },
]

import { createBrowserRouter, RouterProvider } from 'react-router'
import { ToastProvider } from './components/ToastProvider'
import { FavoritesProvider } from './features/favorites/FavoritesProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <RouterProvider router={router} />
      </FavoritesProvider>
    </ToastProvider>
  )
}

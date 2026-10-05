import { createBrowserRouter, RouterProvider } from 'react-router'
import { ToastProvider } from './components/ToastProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

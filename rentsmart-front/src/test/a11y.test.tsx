import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { http as mswHttp, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/ToastProvider'
import { setToken } from '../lib/token'
import { server } from '../mocks/server'
import { routes } from '../routes'

// Revisión automática de accesibilidad (WCAG 2.2 AA) sobre las pantallas reales, con su cabecera y su pie.
// jsdom no calcula estilos ni posiciones, así que quedan fuera el contraste de color y el tamaño de los objetivos
// táctiles: esos se revisan en un navegador (QA-02). Aquí se vigilan los nombres, las etiquetas, los roles, los
// encabezados, los puntos de referencia y el uso correcto de ARIA.
async function violations() {
  const result = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
  })
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const summary = (id: string, name: string, status: string, missing: string[] = []) => ({
  id, status, name, typeName: 'Sala de reuniones', communeName: 'Santiago', pricePerHour: 12000, pricePerDay: null,
  coverUrl: null, missing, updatedAt: '2026-10-05T12:00:00.000Z',
})

describe('accesibilidad (axe)', () => {
  describe('sin sesión', () => {
    it('catálogo', async () => {
      renderAt('/')
      await screen.findByRole('heading', { level: 3, name: 'Sala Alameda' })

      expect(await violations()).toEqual([])
    })

    it('catálogo con filtros aplicados y sin resultados', async () => {
      renderAt('/?q=zzzz&typeId=1&priceUnit=day&minPrice=30000&maxPrice=80000')
      await screen.findByText('No encontramos espacios con esos filtros')

      expect(await violations()).toEqual([])
    })

    it('detalle de un espacio', async () => {
      renderAt('/spaces/seed-space-1')
      await screen.findByRole('heading', { level: 1, name: 'Sala Alameda' })

      expect(await violations()).toEqual([])
    })

    it('detalle de un espacio que no existe', async () => {
      renderAt('/spaces/no-existe')
      await screen.findByRole('heading', { level: 1, name: 'Este espacio no está disponible' })

      expect(await violations()).toEqual([])
    })

    it.each([
      ['/login', 'Iniciar sesión'],
      ['/register', 'Crea tu cuenta'],
      ['/ruta-inexistente', 'No encontramos esta página'],
    ])('%s', async (path, heading) => {
      renderAt(path)
      await screen.findByRole('heading', { level: 1, name: heading })

      expect(await violations()).toEqual([])
    })

    it('formulario de inicio de sesión con errores', async () => {
      renderAt('/login')
      await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }))

      expect(await violations()).toEqual([])
    })
  })

  describe('con sesión', () => {
    it('panel "Mis espacios" con espacios en cada estado', async () => {
      server.use(
        mswHttp.get('*/api/spaces/me', () =>
          HttpResponse.json([
            summary('s1', 'Sala Alameda', 'ACTIVE'),
            summary('s2', 'Estudio Luz', 'INACTIVE', ['photos']),
            summary('s3', 'Taller San Miguel', 'DRAFT', ['photos', 'price']),
            summary('s4', 'Cocina Norte', 'BLOCKED'),
          ]),
        ),
      )
      setToken('abc')
      renderAt('/owner/spaces')
      await screen.findByRole('heading', { level: 2, name: 'Publicaciones' })

      expect(await violations()).toEqual([])
    })

    it('panel con el diálogo de confirmación abierto', async () => {
      server.use(mswHttp.get('*/api/spaces/me', () => HttpResponse.json([summary('s1', 'Sala Alameda', 'ACTIVE')])))
      setToken('abc')
      renderAt('/owner/spaces')
      await userEvent.click(await screen.findByRole('switch', { name: /Sala Alameda/ }))
      await screen.findByRole('dialog', { name: '¿Desactivar este espacio?' })

      expect(await violations()).toEqual([])
    })

    it('panel sin espacios', async () => {
      server.use(mswHttp.get('*/api/spaces/me', () => HttpResponse.json([])))
      setToken('abc')
      renderAt('/owner/spaces')
      await screen.findByRole('heading', { level: 2, name: 'Todavía no tienes espacios' })

      expect(await violations()).toEqual([])
    })

    it('formulario de publicar, en cada uno de sus cinco pasos', async () => {
      setToken('abc')
      renderAt('/publish')
      await screen.findByRole('heading', { level: 1, name: 'Publica tu espacio' })
      expect(await violations()).toEqual([])

      await userEvent.type(screen.getByLabelText('Nombre del espacio'), 'Sala Alameda')
      for (const step of [2, 3, 4, 5]) {
        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
        await screen.findByText(new RegExp(`Paso ${step} de 5`))
        expect(await violations(), `paso ${step}`).toEqual([])
      }
      // El resumen del último paso es parte de la pantalla.
      expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('formulario de publicar con un error de validación', async () => {
      setToken('abc')
      renderAt('/publish')
      await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
      await screen.findByText('Ponle un nombre a tu espacio.')

      expect(await violations()).toEqual([])
    })
  })
})

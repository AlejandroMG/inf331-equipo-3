import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http as mswHttp, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { server } from '../../mocks/server'
import { ProfilePage } from './ProfilePage'
import { PublicProfilePage } from './PublicProfilePage'
import type { MyProfile, PublicProfile } from './api'

const profile: MyProfile = {
  id: 'user-1',
  email: 'ana@example.test',
  name: 'Ana Pérez',
  phone: null,
  bio: null,
  profilePhotoUrl: null,
  role: 'USER',
  isHost: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: 'users/:userId', element },
      { path: '*', element },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('ProfilePage', () => {
  it('edita los campos personales y muestra confirmación al guardar', async () => {
    const user = userEvent.setup()
    server.use(
      mswHttp.get('*/api/users/me', () => HttpResponse.json(profile)),
      mswHttp.patch('*/api/users/me', async ({ request }) => {
        const body = await request.json()
        expect(body).toEqual({ name: 'Ana María', phone: '+56912345678', bio: 'Hola' })
        return HttpResponse.json({
          ...profile,
          name: 'Ana María',
          phone: '+56912345678',
          bio: 'Hola',
        })
      }),
    )
    renderAt('/profile', <ProfilePage />)

    await user.clear(await screen.findByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'Ana María')
    await user.type(screen.getByLabelText('Teléfono'), '+56912345678')
    await user.type(screen.getByLabelText('Sobre mí'), 'Hola')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Tus cambios se guardaron.')
  })

  it('permite subir la foto usando el endpoint multipart', async () => {
    server.use(
      mswHttp.get('*/api/users/me', () => HttpResponse.json(profile)),
      mswHttp.post('*/api/users/me/photo', ({ request }) => {
        expect(request.headers.get('content-type')).toContain('multipart/form-data')
        return HttpResponse.json({ ...profile, profilePhotoUrl: '/profile.jpg' })
      }),
    )
    renderAt('/profile', <ProfilePage />)

    const file = new File(['photo'], 'profile.jpg', { type: 'image/jpeg' })
    fireEvent.change(await screen.findByLabelText('Subir foto de perfil'), {
      target: { files: [file] },
    })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tu foto de perfil se actualizó.'))
  })
})

describe('PublicProfilePage', () => {
  it('muestra antigüedad, calificaciones y reseñas del anfitrión', async () => {
    const publicProfile: PublicProfile = {
      id: 'host-1',
      name: 'Ana Pérez',
      bio: 'Anfitriona',
      profilePhotoUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      reviewCount: 1,
      averageRating: 5,
      reviews: [{
        id: 'review-1',
        authorName: 'Sofía',
        spaceName: 'Sala Alameda',
        rating: 5,
        comment: 'Excelente espacio',
        createdAt: '2026-02-01T00:00:00.000Z',
      }],
    }
    server.use(
      mswHttp.get('*/api/users/host-1/profile', () => HttpResponse.json(publicProfile)),
    )
    renderAt('/users/host-1', <PublicProfilePage />)

    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument()
    expect(screen.getByText(/En RentSmart desde/)).toBeInTheDocument()
    expect(screen.getByText('5.0 de 5')).toBeInTheDocument()
    expect(screen.getByText('Excelente espacio')).toBeInTheDocument()
    expect(screen.getByText('Espacio: Sala Alameda')).toBeInTheDocument()
  })
})

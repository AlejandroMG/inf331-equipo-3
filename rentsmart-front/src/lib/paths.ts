/** Rutas de la app. Se usan desde los componentes para no repetir cadenas. */
export const paths = {
  home: '/',
  space: (id: string) => `/spaces/${id}`,
  /** Una reserva propia: estado, horario, desglose y retención (RE-02). */
  booking: (id: string) => `/bookings/${id}`,
  publish: '/publish',
  /** Continuar un borrador: /publish/<id>. */
  publishDraft: (id: string) => `/publish/${id}`,
  ownerSpaces: '/owner/spaces',
  adminSpaces: '/admin/spaces',
  adminSpaceTypes: '/admin/space-types',
  ownerBookings: '/owner/bookings',
  ownerMetrics: '/owner/metrics',
  favorites: '/favorites',
  profile: '/profile',
  publicProfile: (id: string) => `/users/${id}`,
  login: '/login',
  register: '/register',
  admin: '/admin',
} as const

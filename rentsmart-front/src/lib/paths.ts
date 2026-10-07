/** Rutas de la app. Se usan desde los componentes para no repetir cadenas. */
export const paths = {
  home: '/',
  space: (id: string) => `/spaces/${id}`,
  publish: '/publish',
  /** Continuar un borrador: /publish/<id>. */
  publishDraft: (id: string) => `/publish/${id}`,
  ownerSpaces: '/owner/spaces',
  ownerBookings: '/owner/bookings',
  ownerMetrics: '/owner/metrics',
  favorites: '/favorites',
  login: '/login',
  register: '/register',
  admin: '/admin',
} as const

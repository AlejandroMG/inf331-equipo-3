/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API (sin /api). Si no se define, usa http://localhost:3000. */
  readonly VITE_API_URL?: string
  /** "true" activa MSW en el navegador para simular la API (solo desarrollo). */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

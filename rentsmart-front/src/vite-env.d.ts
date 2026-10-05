/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API (sin /api). Si no se define, usa http://localhost:3000. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

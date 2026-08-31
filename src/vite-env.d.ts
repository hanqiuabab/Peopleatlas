/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDKIT_CONTAINER_ID?: string
  readonly VITE_CLOUDKIT_API_TOKEN?: string
  readonly VITE_CLOUDKIT_ENVIRONMENT?: 'development' | 'production'
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RADARZAP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RADARCHAT_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

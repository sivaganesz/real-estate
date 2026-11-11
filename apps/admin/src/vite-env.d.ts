/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when it differs from the admin app's origin. Empty = same origin / dev proxy. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

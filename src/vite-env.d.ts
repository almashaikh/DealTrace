/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mock API latency in ms. Unset: random 150 to 400 ms. "0" disables the delay. */
  readonly VITE_MOCK_LATENCY_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

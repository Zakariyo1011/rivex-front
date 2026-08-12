/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_REVERB_APP_KEY: string
  readonly VITE_REVERB_HOST: string
  readonly VITE_REVERB_PORT: string
  readonly VITE_REVERB_SCHEME: string
  /** 'osm' (keyless OpenStreetMap embed) or 'none'. Defaults to 'osm'. */
  readonly VITE_MAP_PROVIDER?: 'osm' | 'none'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API(was) 주소. 자세한 동작은 `.env.example` 참고. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

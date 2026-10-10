/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Token do GitHub (fine-grained, só Actions) embutido no build — ver src/lib/githubSync.ts */
  readonly VITE_GITHUB_SYNC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Window augmentation from Electron contextBridge (preload/index.ts)
interface Window {
  electronAPI?: {
    getSidecarUrl: () => Promise<string>;
    openDirectory: () => Promise<string | null>;
  };
}

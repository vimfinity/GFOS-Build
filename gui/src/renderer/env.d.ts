/// <reference types="vite/client" />

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Window augmentation — set by the Electron preload via contextBridge.
// Optional because the renderer also runs in plain browser (dev / future web mode).
interface Window {
  electronAPI?: import('@shared/ipc').ElectronBridge;
}

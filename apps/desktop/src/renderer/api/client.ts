import type { ElectronBridge } from '@gfos-build/contracts';

export function getDesktopApi(): ElectronBridge {
  if (!window.electronAPI) {
    throw new Error('Desktop bridge is unavailable.');
  }
  return window.electronAPI;
}

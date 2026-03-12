// Central point for accessing Electron bridge APIs in the renderer.
// Components import from here instead of touching window.electronAPI directly.

export async function pickDirectory(): Promise<string | null> {
  return window.electronAPI?.openDirectory() ?? null;
}

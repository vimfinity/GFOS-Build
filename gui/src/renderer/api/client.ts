let _sidecarUrl: string | null = null;

export async function getSidecarUrl(): Promise<string> {
  if (_sidecarUrl) return _sidecarUrl;
  if (typeof window !== 'undefined' && window.electronAPI) {
    const url = await window.electronAPI.getSidecarUrl();
    _sidecarUrl = url;
    return url;
  }
  // fallback for dev without Electron
  _sidecarUrl = 'http://localhost:3847';
  return _sidecarUrl;
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const base = await getSidecarUrl();
  await fetch(`${base}${path}`, { method: 'DELETE' });
}

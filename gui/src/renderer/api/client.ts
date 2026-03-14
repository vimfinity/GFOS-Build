import { SIDECAR_FALLBACK_PORT } from '@shared/sidecar';

let _sidecarUrl: string | null = null;

export async function getSidecarUrl(): Promise<string> {
  if (_sidecarUrl) return _sidecarUrl;
  if (typeof window !== 'undefined' && window.electronAPI) {
    const url = await window.electronAPI.getSidecarUrl();
    _sidecarUrl = url;
    return url;
  }
  // fallback for dev without Electron
  _sidecarUrl = `http://localhost:${SIDECAR_FALLBACK_PORT}`;
  return _sidecarUrl;
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`);
  await ensureOk(res, 'GET', path);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  await ensureOk(res, 'POST', path);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  await ensureOk(res, 'PUT', path);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const base = await getSidecarUrl();
  const res = await fetch(`${base}${path}`, { method: 'DELETE' });
  await ensureOk(res, 'DELETE', path);
}

async function ensureOk(res: Response, method: string, path: string): Promise<void> {
  if (res.ok) return;

  let errorMessage = `${method} ${path} failed: ${res.status}`;
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload.error) {
      errorMessage = payload.error;
    }
  } catch {
    // Fall back to the generic status-based message.
  }

  throw new Error(errorMessage);
}

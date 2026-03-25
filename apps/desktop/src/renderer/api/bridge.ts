import { getDesktopApi } from './client';

export async function pickDirectory(): Promise<string | null> {
  return getDesktopApi().openDirectory();
}

export async function pickFile(opts?: {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | null> {
  return getDesktopApi().openFile(opts);
}

import { getDesktopApi } from './client';

export async function pickDirectory(): Promise<string | null> {
  return getDesktopApi().openDirectory();
}

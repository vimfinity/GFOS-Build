/**
 * API Export
 * 
 * Provides the Electron API or Mock API depending on context.
 */

import { getElectronAPI } from './types/mockApi';

// Export the API for use throughout the app
export const api = getElectronAPI();

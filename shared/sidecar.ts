// Local API protocol constants shared between the CLI serve command
// and the Electron desktop app.

// The server writes this prefix followed by the port number to stdout to signal
// that it is ready. Example: "READY:54321"
export const SIDECAR_READY_PREFIX = 'READY:';

// Fallback port used when running the renderer outside Electron (e.g. browser dev).
// Must match the default port the server binds to in that scenario.
export const SIDECAR_FALLBACK_PORT = 3847;

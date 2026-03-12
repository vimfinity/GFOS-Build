import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/cli/index.ts',
  outDir: 'dist/server',
  format: 'esm',
  platform: 'node',
  // bun:sqlite is a Bun built-in — keep external so Bun loads it from the runtime.
  external: ['bun:sqlite'],
  // Bundle the shared workspace package into the server output.
  // It only has TypeScript source (no compiled JS), so it can't be left
  // as an external import that Node.js would try to load at runtime.
  noExternal: ['@gfos-build/shared'],
});

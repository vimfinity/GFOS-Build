import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/cli/index.ts',
  outDir: 'dist/server',
  format: 'esm',
  platform: 'node',
  // better-sqlite3 is a native addon — must stay external so Node.js loads
  // the rebuilt binary from node_modules at runtime.
  external: ['better-sqlite3'],
  // Bundle the shared workspace package into the server output.
  // It only has TypeScript source (no compiled JS), so it can't be left
  // as an external import that Node.js would try to load at runtime.
  noExternal: ['@gfos-build/shared'],
});

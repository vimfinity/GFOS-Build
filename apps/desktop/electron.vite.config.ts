import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@gfos-build/application', '@gfos-build/contracts', '@gfos-build/domain', '@gfos-build/platform-node', 'zod'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@gfos-build/contracts'] })],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@gfos-build/contracts': resolve(__dirname, '../../packages/contracts/index.ts'),
      },
    },
    plugins: [
      TanStackRouterVite({
        routesDirectory: resolve(__dirname, 'src/renderer/routes'),
        generatedRouteTree: resolve(__dirname, 'src/renderer/routeTree.gen.ts'),
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
  },
});

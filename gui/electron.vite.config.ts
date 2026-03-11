import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, '../shared'),
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

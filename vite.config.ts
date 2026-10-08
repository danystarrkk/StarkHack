import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        // ESM canónico: Vite 8 avisa que __dirname no sobrevive al
        // configLoader nativo que será default en versiones futuras.
        '@': path.dirname(fileURLToPath(import.meta.url)),
      }
    }
});

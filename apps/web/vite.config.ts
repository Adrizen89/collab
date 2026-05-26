import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// envDir pointe vers la racine du monorepo : les variables VITE_* du .env
// racine sont chargées. L'alias résout @collab/shared vers la source TS
// (pas besoin de build préalable du paquet partagé pour le front).
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(import.meta.dirname, '../..'),
  resolve: {
    alias: {
      '@collab/shared': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const manualVendorChunks = (id: string) => {
    if (!id.includes('node_modules')) return;

    if (id.includes('react-router-dom')) return 'vendor-router';
    if (id.includes('@tanstack/react-query')) return 'vendor-query';
    if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
      return 'vendor-forms';
    }
    if (id.includes('recharts')) return 'vendor-charts';
    if (id.includes('lucide-react')) return 'vendor-icons';
    if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
      return 'vendor-react';
    }
  };

  return {
    server: {
      port: Number(env.VITE_PORT) || 5173,
      host: '0.0.0.0',
    },
    preview: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT) || 4173,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1100,
      rolldownOptions: {
        output: {
          codeSplitting: true,
          manualChunks: manualVendorChunks,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: manualVendorChunks,
        },
      },
    },
  };
});
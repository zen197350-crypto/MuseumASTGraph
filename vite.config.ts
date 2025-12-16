import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api requests to the backend during local development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});
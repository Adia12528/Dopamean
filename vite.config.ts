import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL?.trim() ||
    (mode === 'production' ? 'https://dopamean-api.onrender.com' : '');
  if (mode === 'production') {
    let apiUrl: URL;
    try {
      apiUrl = new URL(apiBase);
    } catch {
      throw new Error('VITE_API_BASE_URL must be a valid HTTPS origin.');
    }
    if (apiUrl.protocol !== 'https:' || apiUrl.origin !== apiBase.replace(/\/$/, '') || apiUrl.pathname !== '/') {
      throw new Error('VITE_API_BASE_URL must be an HTTPS origin without a path, query, or credentials.');
    }
  }

  return {
    define: {
      __DOPAMEAN_API_BASE_URL__: JSON.stringify(apiBase)
    },
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true
        }
      }
    }
  };
});

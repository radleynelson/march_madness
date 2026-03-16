import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5199,
    host: true,
    proxy: {
      '/api/torvik': {
        target: 'https://barttorvik.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/torvik/, ''),
      },
    },
  },
})

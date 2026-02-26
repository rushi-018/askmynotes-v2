import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    watch: {
      usePolling: true,
    },
    host: true,
    port: 5173,
    proxy: {
      // ── Auth backend (port 8001) ──
      '/api/auth': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/api/users': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/api/chat': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      // ── RAG backend (port 8000) ──
      '/upload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/voice-chat': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/study_mode': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/subjects': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/reset': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost/back',
        changeOrigin: true,
        secure: false,
      },
      '/index.php': {
        target: 'http://localhost/back',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

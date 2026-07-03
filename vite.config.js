import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // Allow external devices on network to access (crucial for local testing)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',        // ✅ Required for Electron (file://) builds
  plugins: [react()],
  server: {
    port: 5173,
  },
});

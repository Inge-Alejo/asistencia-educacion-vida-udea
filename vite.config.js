import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/xlsx/')) {
            return 'vendor-xlsx';
          }
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/html2canvas/')) {
            return 'vendor-html2canvas';
          }
          if (id.includes('node_modules/dompurify/')) {
            return 'vendor-dompurify';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

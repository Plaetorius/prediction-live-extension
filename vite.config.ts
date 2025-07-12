import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html')
        // content and background are built separately
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunk-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].css'
          }
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].html'
          }
          return 'asset-[hash].[ext]'
        },
        manualChunks: undefined
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}) 
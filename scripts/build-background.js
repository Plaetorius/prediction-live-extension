import { build } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function buildBackgroundScript() {
  try {
    await build({
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, '../src/background/background.ts'),
          output: {
            entryFileNames: 'background.js',
            chunkFileNames: 'chunk-[hash].js',
            assetFileNames: 'asset-[hash].[ext]',
            format: 'iife',
            name: 'BackgroundScript'
          }
        }
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, '../src')
        }
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    })
    console.log('Background script built successfully')
  } catch (error) {
    console.error('Error building background script:', error)
    process.exit(1)
  }
}

buildBackgroundScript() 
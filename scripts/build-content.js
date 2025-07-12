import { build } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function buildContentScript() {
  try {
    await build({
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, '../src/content/content.ts'),
          output: {
            entryFileNames: 'content.js',
            format: 'iife',
            name: 'ContentScript'
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
    console.log('Content script built successfully')
  } catch (error) {
    console.error('Error building content script:', error)
    process.exit(1)
  }
}

buildContentScript() 
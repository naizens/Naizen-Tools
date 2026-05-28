import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: false,
      lib: {
        entry: resolve('electron/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: false,
      lib: {
        entry: resolve('electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      sourcemap: false,
      rollupOptions: {
        input: resolve('index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    plugins: [react()],
  },
})

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from 'rollup-plugin-visualizer'

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
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        input: resolve('index.html'),
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'zustand'],
          },
        },
        plugins: [
          visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ],
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

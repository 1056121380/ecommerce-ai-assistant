import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString('zh-CN', { hour12: false }))
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    target: 'es2022',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const elementComponent = id.match(/element-plus[\\/]es[\\/]components[\\/]([^\\/]+)/)
          if (elementComponent) return `el-${elementComponent[1]}`
          if (id.includes('element-plus')) return 'element-core'
          if (id.includes('@element-plus/icons-vue')) return 'icons'
          if (id.includes('papaparse')) return 'parser'
          if (id.includes('vue') || id.includes('pinia')) return 'vue'
        }
      }
    }
  }
})

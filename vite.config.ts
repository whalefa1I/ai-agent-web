import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ai-agent-server-production-d28a.up.railway.app',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'utils': ['marked', 'highlight.js', 'ws']
        }
      }
    }
  },
  // 跳过 TypeScript 检查，让构建继续（类型错误不阻断构建）
  define: {
    'process.env': {}
  }
})

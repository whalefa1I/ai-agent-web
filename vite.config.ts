import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // 加载环境变量（.env 文件）
  const env = loadEnv(mode, process.cwd(), '')

  // 从环境变量获取服务器地址，默认使用 Railway 生产环境
  const serverUrl = env.VITE_API_BASE_URL || env.VITE_SERVER_URL || 'http://localhost:8080'

  // 解析服务器 host（用于 WebSocket）
  const serverHost = serverUrl.replace(/^https?:\/\//, '')
  const isHttps = serverUrl.startsWith('https:')

  return {
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
          target: serverUrl,
          changeOrigin: true
        },
        '/ws': {
          target: serverUrl,
          changeOrigin: true,
          ws: true  // 启用 WebSocket 代理
        }
      }
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['vue', 'vue-router', 'pinia'],
            'utils': ['marked', 'highlight.js']
          }
        }
      }
    },
    // 定义全局环境变量
    define: {
      'process.env': {},
      '__ENV_SERVER_URL__': JSON.stringify(serverUrl)
    }
  }
})

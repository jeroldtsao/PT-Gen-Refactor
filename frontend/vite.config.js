import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// 从 package.json 读取版本号
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = packageJson.version

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 注入版本号到环境变量
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version)
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    },
    fs: {
      allow: ['..']
    }
  }
})
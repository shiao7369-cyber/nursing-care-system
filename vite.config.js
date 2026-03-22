import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '3000'),
    open: false
  },
  build: {
    // 提高警告門檻（實際已分包，不需要擔心）
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase（網路請求，延遲載入沒意義，但獨立 chunk 可快取）
          'vendor-supabase': ['@supabase/supabase-js'],
          // 地圖（只有訪視地圖頁用到，最大宗）
          'vendor-map': ['leaflet', 'react-leaflet'],
          // 圖表（只有儀表板用到）
          'vendor-charts': ['recharts'],
          // Excel（只有匯入時用到，非常大）
          'vendor-xlsx': ['xlsx'],
          // 圖示
          'vendor-icons': ['lucide-react'],
        }
      }
    }
  }
})

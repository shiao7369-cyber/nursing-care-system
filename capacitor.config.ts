import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.minsheng.nursing',
  appName: '居護所個案管理',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // 開發時可改為你的 Vercel URL 方便即時測試
    // url: 'https://nursing-care-system.vercel.app',
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
}

export default config

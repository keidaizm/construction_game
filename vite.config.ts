import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Rapier（物理エンジン）は WASM を JS に埋め込んでいるため、単体で約 2MB ある
    chunkSizeWarningLimit: 2500,
    rolldownOptions: {
      output: {
        // 物理エンジンと three を別ファイルにして、アプリ更新時もブラウザのキャッシュを効かせる
        codeSplitting: {
          groups: [
            { name: 'rapier', test: /rapier3d-compat/ },
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
})

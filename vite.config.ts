import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep CSS readable and avoid platform-native Lightning CSS requirements.
  build: { cssMinify: false },
  server: { port: 5173, strictPort: true },
});

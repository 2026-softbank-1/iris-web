import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  // dev 서버는 /api 를 API(was)로 넘긴다. 브라우저는 같은 origin 으로만 호출하므로
  // was 에 CORS 설정이 없어도 되고, 로그인 세션 쿠키도 그대로 오간다.
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    // Keep CSS readable and avoid platform-native Lightning CSS requirements.
    build: { cssMinify: false },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
  };
});

import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * VITE_MOCK_API=1 이면 dev 서버가 /api/v1 을 was 대신 src/dev/mockApi.ts 로 답한다.
 * 백엔드·로그인 없이 배포 화면을 디자인하려는 용도다. build 에는 영향이 없다.
 */
function mockApi(): Plugin {
  const PREFIX = '/api/v1';
  return {
    name: 'likelion-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next();
        const mock = await server.ssrLoadModule('/src/dev/mockApi.ts');
        const url = new URL(req.url, 'http://mock');
        const path = url.pathname.slice(PREFIX.length);

        // 로그 SSE: 2초마다 새 로그를 보낸다.
        const stream = path.match(/^\/services\/(\d+)\/logs\/stream$/);
        if (stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          const send = () => {
            const entries = mock.liveLogs(Number(stream[1]));
            if (entries.length) res.write(`id: ${entries.at(-1).timestampNs}\nevent: logs\ndata: ${JSON.stringify(entries)}\n\n`);
          };
          const timer = setInterval(send, 2000);
          req.on('close', () => clearInterval(timer));
          return;
        }

        let raw = '';
        for await (const chunk of req) raw += chunk;
        const out = mock.handle(req.method ?? 'GET', path, Object.fromEntries(url.searchParams), raw ? JSON.parse(raw) : undefined);
        await new Promise((r) => setTimeout(r, 150)); // 로딩 상태도 보이게
        if (out.redirect) {
          res.writeHead(302, { Location: out.redirect }).end();
          return;
        }
        res.writeHead(out.status, out.body === undefined ? {} : { 'Content-Type': 'application/json' });
        res.end(out.body === undefined ? undefined : JSON.stringify(out.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const useMock = env.VITE_MOCK_API === '1';
  // dev 서버는 /api 를 API(was)로 넘긴다. 브라우저는 같은 origin 으로만 호출하므로
  // was 에 CORS 설정이 없어도 되고, 로그인 세션 쿠키도 그대로 오간다.
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8000';

  return {
    plugins: [react(), ...(useMock ? [mockApi()] : [])],
    // Keep CSS readable and avoid platform-native Lightning CSS requirements.
    build: { cssMinify: false },
    server: {
      port: 5173,
      strictPort: true,
      proxy: useMock ? undefined : { '/api': { target: apiTarget, changeOrigin: true } },
    },
  };
});

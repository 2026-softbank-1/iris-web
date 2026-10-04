// 개발용 가짜 Console Gateway. `VITE_MOCK_API=1` 일 때 vite dev 서버가 `/mock-console-gateway/v1/{pods,exec}` 를 같은 서버에서 답한다.
// 진짜 Gateway 의 프로토콜(REST /v1/pods, WebSocket /v1/exec 의 auth → ready → input·output·resize·ping)만 흉내 내고,
// 셸은 몇 가지 명령에만 답하는 가짜다. 앱 번들에는 들어가지 않는다.
//
// 화면의 오류 안내를 보려면 셸에서 `mock-error <CODE>` 를 입력한다(예: mock-error SHELL_NOT_FOUND, mock-error IDLE_TIMEOUT).
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { ViteDevServer } from 'vite';

export const MOCK_GATEWAY_PATH = '/mock-console-gateway';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const AUTH_TIMEOUT_MS = 5000;

type Pod = { name: string; phase: string; ready: boolean; startedAt: string; releaseId: number | null };

/** token 은 `mock-{serviceId}-{n}` 이다(mockApi 가 만든다). 레플리카가 여럿인 서비스(11)는 Pod 를 고르는 화면을 볼 수 있게 3개를 돌려준다. */
const serviceIdOf = (token: string) => Number(/^mock-(\d+)-/.exec(token)?.[1] ?? NaN);

function podsOf(serviceId: number): Pod[] {
  const started = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  if (serviceId === 11) {
    return [
      { name: 'app-6d9f7c-9fz4t', phase: 'Running', ready: true, startedAt: started(4), releaseId: 1001 },
      { name: 'app-6d9f7c-xk2lq', phase: 'Running', ready: true, startedAt: started(9), releaseId: 1001 },
      { name: 'app-6d9f7c-pend1', phase: 'Pending', ready: false, startedAt: started(1), releaseId: 1001 },
    ];
  }
  return [{ name: 'app-5b8c76-r7wqd', phase: 'Running', ready: true, startedAt: started(12), releaseId: 1001 }];
}

/* ------------------------------------------------------------------ */
/* WebSocket 프레임(텍스트만)                                              */
/* ------------------------------------------------------------------ */

function encodeText(text: string): Buffer {
  const payload = Buffer.from(text);
  const n = payload.length;
  const header = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 0xff]) : Buffer.concat([Buffer.from([0x81, 127]), Buffer.alloc(8)]);
  if (n >= 65536) header.writeBigUInt64BE(BigInt(n), 2);
  return Buffer.concat([header, payload]);
}

/** 브라우저가 보내는 마스킹된 프레임을 읽는다. 조각난 메시지·바이너리는 쓰지 않는 프로토콜이라 다루지 않는다. */
function* decodeFrames(state: { buffer: Buffer }): Generator<{ opcode: number; payload: Buffer }> {
  for (;;) {
    const b = state.buffer;
    if (b.length < 2) return;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let length = b[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (b.length < 4) return;
      length = b.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return;
      length = Number(b.readBigUInt64BE(2));
      offset = 10;
    }
    const total = offset + (masked ? 4 : 0) + length;
    if (b.length < total) return;
    const mask = masked ? b.subarray(offset, offset + 4) : null;
    const payload = Buffer.from(b.subarray(offset + (masked ? 4 : 0), total));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    state.buffer = b.subarray(total);
    yield { opcode, payload };
  }
}

/* ------------------------------------------------------------------ */
/* 가짜 셸                                                               */
/* ------------------------------------------------------------------ */

const ls = '\x1b[0mCaddyfile  \x1b[1;34mdist\x1b[0m  index.html  \x1b[1;34mnode_modules\x1b[0m  package.json  \x1b[1;34msrc\x1b[0m  vite.config.js';
const HELP = [
  'Available: help, ls, pwd, whoami, uptime, node -v, env, cat package.json, stty size, colors, clear, exit [code]',
  'Mock only: mock-error <CODE>  (e.g. SHELL_NOT_FOUND, IDLE_TIMEOUT, MAX_DURATION_EXCEEDED, SESSION_LIMIT_EXCEEDED, CLUSTER_UNAVAILABLE)',
];

type Session = { serviceId: number; pod: string; cols: number; rows: number; line: string };

type Reply = { lines?: string[]; frame?: object };

function run(command: string, s: Session): Reply {
  const [bin, ...args] = command.trim().split(/\s+/);
  switch (bin) {
    case '':
      return {};
    case 'help':
      return { lines: HELP };
    case 'ls':
      return { lines: [ls] };
    case 'pwd':
      return { lines: ['/app'] };
    case 'whoami':
      return { lines: ['root'] };
    case 'uptime':
      return { lines: [' 21:27:04 up 1 day, 52 min,  0 users,  load average: 0.00, 0.01, 0.00'] };
    case 'node':
      return { lines: [args[0] === '-v' ? 'v24.21.0' : 'Interactive mode is not available in the mock shell.'] };
    case 'env':
      return { lines: [`IRIS_SERVICE_ID=${s.serviceId}`, 'IRIS_TARGET_NAME=aws-seoul', 'PORT=8080', 'HOME=/root', `HOSTNAME=${s.pod}`, `COLUMNS=${s.cols}`] };
    case 'cat':
      return { lines: args[0] === 'package.json' ? ['{', '  "name": "app",', '  "scripts": { "start": "node server.js" }', '}'] : [`cat: ${args[0] ?? ''}: No such file or directory`] };
    case 'stty':
      return { lines: [`${s.rows} ${s.cols}`] };
    case 'colors':
      return { lines: [[30, 31, 32, 33, 34, 35, 36, 37].map((c) => `\x1b[${c}m${c}\x1b[0m`).join(' '), [90, 91, 92, 93, 94, 95, 96, 97].map((c) => `\x1b[${c}m${c}\x1b[0m`).join(' ')] };
    case 'clear':
      return { lines: ['\x1b[2J\x1b[H'] };
    case 'exit':
      return { frame: { type: 'exit', code: Number(args[0] ?? 0) || 0 } };
    case 'mock-error':
      return { frame: { type: 'error', code: args[0] ?? 'INTERNAL_ERROR', message: `mock error ${args[0] ?? ''}`.trim() } };
    default:
      return { lines: [`sh: ${bin}: command not found`] };
  }
}

const prompt = (s: Session) => `\x1b[32mroot@${s.pod}\x1b[0m:\x1b[34m/app\x1b[0m# `;

/* ------------------------------------------------------------------ */
/* 연결                                                                  */
/* ------------------------------------------------------------------ */

// 진짜 Gateway 처럼 ticket 은 연결(auth)에 한 번만 쓸 수 있다. 화면이 연결마다 새 세션을 받는지 확인할 수 있다.
const usedTokens = new Set<string>();

function handleSocket(socket: Duplex, query: URLSearchParams) {
  const pod = query.get('pod') ?? '';
  const state = { buffer: Buffer.alloc(0) };
  let session: Session | null = null;
  let closed = false;

  const send = (frame: object) => !closed && socket.write(encodeText(JSON.stringify(frame)));
  const output = (data: string) => send({ type: 'output', data });
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(authTimer);
    socket.end(Buffer.from([0x88, 0x00]));
  };
  const fail = (code: string, message: string) => {
    send({ type: 'error', code, message });
    close();
  };
  const authTimer = setTimeout(() => !session && fail('UNAUTHORIZED', 'auth frame required'), AUTH_TIMEOUT_MS);

  const onFrame = (raw: string) => {
    let frame: { type?: string; token?: string; cols?: number; rows?: number; data?: string };
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }
    if (!session) {
      const serviceId = serviceIdOf(frame.token ?? '');
      if (frame.type !== 'auth' || Number.isNaN(serviceId)) return fail('UNAUTHORIZED', 'invalid ticket');
      if (usedTokens.has(frame.token!)) return fail('TOKEN_REUSED', 'ticket already used');
      usedTokens.add(frame.token!);
      if (!podsOf(serviceId).some((p) => p.name === pod)) return fail('POD_NOT_FOUND', 'pod not found');
      clearTimeout(authTimer);
      session = { serviceId, pod, cols: frame.cols ?? 80, rows: frame.rows ?? 24, line: '' };
      send({ type: 'ready', pod, shell: 'bash' });
      output(`\x1b[2mMock shell on ${pod}. Type "help".\x1b[0m\r\n${prompt(session)}`);
      return;
    }
    if (frame.type === 'ping') return void send({ type: 'pong' });
    if (frame.type === 'resize') {
      session.cols = frame.cols ?? session.cols;
      session.rows = frame.rows ?? session.rows;
      return;
    }
    if (frame.type !== 'input' || typeof frame.data !== 'string') return;
    if (frame.data.startsWith('\x1b')) return; // 방향키 같은 이스케이프 시퀀스는 무시한다.
    for (const ch of frame.data) {
      if (ch === '\r') {
        output('\r\n');
        const reply = run(session.line, session);
        session.line = '';
        for (const line of reply.lines ?? []) output(`${line}\r\n`);
        if (reply.frame) {
          send(reply.frame);
          return close();
        }
        output(prompt(session));
      } else if (ch === '\x7f') {
        if (session.line.length > 0) {
          session.line = session.line.slice(0, -1);
          output('\b \b');
        }
      } else if (ch === '\x03') {
        session.line = '';
        output(`^C\r\n${prompt(session)}`);
      } else if (ch >= ' ') {
        session.line += ch;
        output(ch);
      }
    }
  };

  socket.on('data', (chunk: Buffer) => {
    state.buffer = Buffer.concat([state.buffer, chunk]);
    for (const { opcode, payload } of decodeFrames(state)) {
      if (opcode === 0x1) onFrame(payload.toString('utf8'));
      else if (opcode === 0x9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
      else if (opcode === 0x8) return close();
    }
  });
  socket.on('close', () => {
    closed = true;
    clearTimeout(authTimer);
  });
  socket.on('error', () => undefined);
}

/** vite dev 서버에 가짜 Gateway(REST + WebSocket)를 붙인다. */
export function attachMockConsoleGateway(server: ViteDevServer) {
  server.middlewares.use(`${MOCK_GATEWAY_PATH}/v1/pods`, (req, res) => {
    const token = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1] ?? '';
    const serviceId = serviceIdOf(token);
    res.setHeader('Content-Type', 'application/json');
    if (Number.isNaN(serviceId)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'invalid ticket' }));
      return;
    }
    res.end(JSON.stringify({ success: true, data: { pods: podsOf(serviceId) } }));
  });

  server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex) => {
    const url = new URL(req.url ?? '', 'http://mock');
    if (url.pathname !== `${MOCK_GATEWAY_PATH}/v1/exec`) return; // vite 의 HMR 소켓 등은 건드리지 않는다.
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') return void socket.destroy();
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    handleSocket(socket, url.searchParams);
  });
}

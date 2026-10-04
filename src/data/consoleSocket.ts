import { PING_INTERVAL_MS, READY_TIMEOUT_MS, execUrl, parseServerFrame, type ConsoleClientFrame, type ConsoleEnd } from './consoleModel';

export type ConsoleSocketHandlers = {
  /** Gateway 가 셸을 열었다. 이때부터 입력·resize 를 보낸다. */
  onReady: (info: { pod: string; shell?: string }) => void;
  onOutput: (data: string) => void;
  /** 셸이 끝났거나 Gateway 가 오류를 알리고 닫았거나 연결이 끊겼다. 한 연결에서 한 번만 불린다. */
  onEnd: (end: ConsoleEnd) => void;
};

export type ConsoleSocket = {
  input: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  /** 사용자가 닫는 경우. 이후에는 핸들러를 부르지 않는다. */
  close: () => void;
};

/**
 * Console Gateway 의 exec WebSocket 을 열고 프로토콜(auth → ready → input·output·resize·ping)을 처리한다.
 * 토큰은 URL 이 아니라 연결 뒤 첫 프레임으로 보낸다(URL 은 접근 로그에 남을 수 있다).
 * 화면 모양(xterm)은 모르고 입출력과 끝난 이유만 올려준다.
 */
export function openConsoleSocket(
  { wsUrl, pod, token, cols, rows }: { wsUrl: string; pod: string; token: string; cols: number; rows: number },
  handlers: ConsoleSocketHandlers,
): ConsoleSocket {
  let ws: WebSocket;
  try {
    ws = new WebSocket(execUrl(wsUrl, pod));
  } catch {
    // 주소가 잘못돼 생성 자체가 실패한 경우.
    queueMicrotask(() => handlers.onEnd({ kind: 'error', code: 'GATEWAY_UNREACHABLE' }));
    return { input: () => undefined, resize: () => undefined, close: () => undefined };
  }

  let ready = false;
  let finished = false;
  let pingTimer: number | undefined;
  let readyTimer: number | undefined;
  // 연결 중에 창 크기가 바뀌면 ready 가 된 뒤 마지막 크기를 한 번 보낸다.
  let pendingSize: { cols: number; rows: number } | null = null;

  const send = (frame: ConsoleClientFrame) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  };
  const cleanup = () => {
    window.clearInterval(pingTimer);
    window.clearTimeout(readyTimer);
  };
  const finish = (end: ConsoleEnd) => {
    if (finished) return;
    finished = true;
    cleanup();
    handlers.onEnd(end);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000);
  };

  ws.onopen = () => {
    send({ type: 'auth', token, cols, rows });
    pingTimer = window.setInterval(() => send({ type: 'ping' }), PING_INTERVAL_MS);
    readyTimer = window.setTimeout(() => finish({ kind: 'error', code: 'CONNECT_TIMEOUT' }), READY_TIMEOUT_MS);
  };

  ws.onmessage = (event) => {
    const frame = parseServerFrame(event.data);
    if (!frame || finished) return;
    switch (frame.type) {
      case 'ready':
        ready = true;
        window.clearTimeout(readyTimer);
        handlers.onReady({ pod: frame.pod, shell: frame.shell });
        if (pendingSize) {
          send({ type: 'resize', ...pendingSize });
          pendingSize = null;
        }
        break;
      case 'output':
        handlers.onOutput(frame.data);
        break;
      case 'exit':
        finish({ kind: 'exit', code: frame.code });
        break;
      case 'error':
        finish({ kind: 'error', code: frame.code, message: frame.message });
        break;
      case 'pong':
        break;
    }
  };

  // 오류 뒤에는 항상 close 가 오므로 끝난 이유는 거기서 한 번만 정한다.
  ws.onerror = () => undefined;
  ws.onclose = () => {
    // 셸이 열리기 전에 끊겼으면 Gateway 에 닿지 못한 것이고, 열린 뒤라면 연결이 끊어진 것이다.
    finish(ready ? { kind: 'closed' } : { kind: 'error', code: 'GATEWAY_UNREACHABLE' });
  };

  return {
    input: (data) => {
      if (ready && !finished) send({ type: 'input', data });
    },
    resize: (c, r) => {
      if (finished) return;
      if (ready) send({ type: 'resize', cols: c, rows: r });
      else pendingSize = { cols: c, rows: r };
    },
    close: () => {
      if (finished) return;
      finished = true;
      cleanup();
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000);
    },
  };
}

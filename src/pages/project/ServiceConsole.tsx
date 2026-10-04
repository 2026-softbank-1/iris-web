import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ChevronDown, Maximize2, Minimize2, RefreshCw, RotateCw, TerminalSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Popover, usePopover } from '../../components/ui';
import {
  CONSOLE_ERROR_KEYS,
  autoConnectPod,
  consoleFailureOf,
  endAction,
  isPodConnectable,
  isTimeoutEnd,
  terminalTheme,
  unavailableKey,
  unavailableReasonOf,
  type ConsoleConn,
  type ConsoleEnd,
  type ConsoleFailure,
} from '../../data/consoleModel';
import { openConsoleSocket, type ConsoleSocket } from '../../data/consoleSocket';
import type { Service } from '../../data/mock';
import { useConsoleAvailability, useConsolePods } from '../../data/useServiceConsole';
import { useI18n, type MessageKey } from '../../i18n';
import * as api from '../../lib/endpoints';

type T = ReturnType<typeof useI18n>['t'];

/** Gateway·API 가 준 실패를 문구로. 번역이 없는 코드는 서버 message 를 그대로 쓴다. */
function failureText(t: T, failure: ConsoleFailure): string {
  const key = CONSOLE_ERROR_KEYS[failure.code];
  return key ? t(key) : (failure.message ?? t('service.console.err.INTERNAL_ERROR'));
}

function endText(t: T, end: ConsoleEnd): string {
  if (end.kind === 'exit') return end.code === undefined ? t('service.console.exitedNoCode') : t('service.console.exited', { code: end.code });
  if (end.kind === 'closed') return t('service.console.closed');
  return failureText(t, end);
}

/** 콘솔 영역을 대신 채우는 안내(열 수 없음·불러오는 중·오류). */
function ConsoleNotice({ title, sub, busy, children }: { title: string; sub?: string; busy?: boolean; children?: ReactNode }) {
  return (
    <div className="console-offline">
      {busy ? <div className="diag-spinner sm" aria-hidden /> : <TerminalSquare size={20} aria-hidden />}
      <p>{title}</p>
      {sub && <span>{sub}</span>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pod 목록                                                              */
/* ------------------------------------------------------------------ */

function PodList({ pods, selected, onSelect, className }: { pods: api.ConsolePodDto[]; selected?: string; onSelect: (pod: string) => void; className: string }) {
  const { t } = useI18n();
  return (
    <>
      {pods.map((pod) => {
        const connectable = isPodConnectable(pod);
        const started = pod.startedAt ? new Date(pod.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
        return (
          <button key={pod.name} type="button" className={className} data-active={pod.name === selected} disabled={!connectable} onClick={() => onSelect(pod.name)}>
            <span className="mono console-pod-name">{pod.name}</span>
            <span className="console-pod-meta">
              {connectable ? t('service.console.podReady') : t('service.console.podNotReady', { phase: pod.phase })}
              {started && ` · ${started}`}
            </span>
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 세션: 터미널 + 연결                                                      */
/* ------------------------------------------------------------------ */

function ConsoleSession({ serviceId, targetId, onUnavailable }: { serviceId: string; targetId: number; onUnavailable: (reason: string) => void }) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const socketRef = useRef<ConsoleSocket | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  // 연결을 시작할 때마다 올라간다. 끝난(교체된) 연결의 콜백이 새 화면 상태를 덮지 않게 비교한다.
  const genRef = useRef(0);
  const autoRef = useRef(false);
  const connRef = useRef<ConsoleConn>({ kind: 'idle' });
  const [conn, setConnState] = useState<ConsoleConn>({ kind: 'idle' });
  const [full, setFull] = useState(false);
  const pop = usePopover();
  const { pods, error, loading, refresh } = useConsolePods(serviceId, targetId, onUnavailable);

  const setConn = useCallback((next: ConsoleConn) => {
    connRef.current = next;
    setConnState(next);
  }, []);

  // 터미널은 화면이 열려 있는 동안 하나를 유지한다. 재연결·Pod 전환은 같은 터미널에 이어 쓴다.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = document.documentElement;
    const term = new Terminal({
      fontFamily: getComputedStyle(root).getPropertyValue('--font-mono').trim() || 'monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      scrollback: 5000,
      theme: terminalTheme(root),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.textarea?.setAttribute('aria-label', t('service.console.input'));
    // Linux·Windows 의 복사 단축키. 선택이 없으면 Ctrl+Shift+C 도 그대로 셸로 간다.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC' && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
        return false;
      }
      return true;
    });

    const refit = () => {
      try {
        fit.fit();
      } catch {
        // 아직 레이아웃이 없을 때(숨겨진 탭 등)는 다음 크기 변화에서 다시 맞춘다.
      }
    };
    refit();
    const inputSub = term.onData((data) => socketRef.current?.input(data));
    const resizeSub = term.onResize(({ cols, rows }) => socketRef.current?.resize(cols, rows));
    let frame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refit);
    });
    resizeObserver.observe(host);
    // 라이트·다크 전환을 따라간다.
    const themeObserver = new MutationObserver(() => {
      term.options.theme = terminalTheme(root);
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    termRef.current = term;

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      inputSub.dispose();
      resizeSub.dispose();
      // 화면을 떠나면 셸 연결도 끊는다. 이 안에서 일어나는 콜백은 gen 이 달라서 무시된다.
      genRef.current++;
      ctrlRef.current?.abort();
      socketRef.current?.close();
      socketRef.current = null;
      termRef.current = null;
      term.dispose();
    };
    // 터미널은 한 번만 만든다. 번역은 접근성 라벨에만 쓰고 언어가 바뀌어도 다시 만들 필요는 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 이 Pod 에 새 세션(ticket)을 받아 셸을 연다. 이전 연결은 닫는다. */
  const connect = useCallback(
    async (pod: string) => {
      const term = termRef.current;
      if (!term) return;
      const gen = ++genRef.current;
      ctrlRef.current?.abort();
      socketRef.current?.close();
      socketRef.current = null;
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      // 다른 Pod 로 옮기면 화면을 비우고, 같은 Pod 에 다시 연결하면 이전 출력을 남긴 채 구분선만 넣는다.
      const previous = connRef.current;
      if (previous.kind === 'idle' || previous.pod !== pod) term.reset();
      else term.write('\r\n\x1b[2m────────\x1b[0m\r\n');
      setConn({ kind: 'connecting', pod });

      let session: api.ConsoleSessionDto;
      try {
        session = await api.createConsoleSession(serviceId, targetId, ctrl.signal);
      } catch (e) {
        if (gen !== genRef.current) return;
        const reason = unavailableReasonOf(e);
        if (reason) {
          onUnavailable(reason);
          return;
        }
        setConn({ kind: 'ended', pod, end: { kind: 'error', ...consoleFailureOf(e, 'api') } });
        return;
      }
      if (gen !== genRef.current) return;

      socketRef.current = openConsoleSocket(
        { wsUrl: session.gateway.wsUrl, pod, token: session.token, cols: term.cols, rows: term.rows },
        {
          onReady: ({ pod: ready, shell }) => {
            if (gen !== genRef.current) return;
            setConn({ kind: 'connected', pod: ready, shell });
            term.focus();
          },
          onOutput: (data) => {
            if (gen === genRef.current) term.write(data);
          },
          onEnd: (end) => {
            if (gen !== genRef.current) return;
            socketRef.current = null;
            setConn({ kind: 'ended', pod, end });
          },
        },
      );
    },
    [serviceId, targetId, onUnavailable, setConn],
  );

  // Pod 가 하나뿐이고 준비돼 있으면 고르게 하지 않고 바로 연다.
  useEffect(() => {
    if (autoRef.current || !pods) return;
    const target = autoConnectPod(pods);
    if (!target) return;
    autoRef.current = true;
    void connect(target.name);
  }, [pods, connect]);

  /** 목록을 새로 받는다. 받은 뒤 하나뿐이고 준비돼 있으면 다시 자동으로 연결한다(교체된 Pod 를 따라가는 경우). */
  const reloadPods = useCallback(() => {
    autoRef.current = false;
    void refresh();
  }, [refresh]);

  /** 연결이 끝난 Pod 를 포기하고 목록을 새로 받는다. 받은 뒤 하나뿐이면 자동으로 연결하고, 여러 개면 고르게 한다. */
  const leavePod = () => {
    setConn({ kind: 'idle' });
    reloadPods();
  };

  const selectPod = (pod: string) => {
    pop.close();
    void connect(pod);
  };

  const connected = conn.kind === 'connected';
  const connecting = conn.kind === 'connecting';
  const ended = conn.kind === 'ended' ? conn : null;
  const action = ended ? endAction(ended.end) : 'none';
  const currentPod = conn.kind === 'idle' ? null : conn.pod;
  const statusTone = connected ? 'ok' : connecting ? 'pending' : 'off';
  const statusLabel = connected ? t('service.console.connected') : connecting ? t('service.console.connecting') : t('service.console.disconnected');

  // 터미널 위에 얹는 안내. 연결 전(고르는 중·불러오는 중)에만 터미널을 가린다.
  let overlay: ReactNode = null;
  if (conn.kind === 'idle') {
    const auto = pods ? autoConnectPod(pods) : null;
    if (error) {
      overlay = (
        <ConsoleNotice title={failureText(t, error)}>
          <button type="button" className="btn btn-outline btn-sm" onClick={reloadPods}>
            <RefreshCw size={14} />
            {t('service.console.retry')}
          </button>
        </ConsoleNotice>
      );
    } else if (!pods || auto || loading) {
      overlay = <ConsoleNotice busy title={auto ? t('service.console.connecting') : t('service.console.replicaLoading')} />;
    } else if (pods.length === 0) {
      overlay = (
        <ConsoleNotice title={t('service.console.noReplicas')} sub={t('service.console.noReplicasSub')}>
          <button type="button" className="btn btn-outline btn-sm" onClick={reloadPods} disabled={loading}>
            <RefreshCw size={14} />
            {t('service.console.refresh')}
          </button>
        </ConsoleNotice>
      );
    } else {
      overlay = (
        <ConsoleNotice title={t('service.console.pickReplica')} sub={t('service.console.pickReplicaSub')}>
          <div className="console-pods">
            <PodList pods={pods} onSelect={selectPod} className="console-pod" />
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reloadPods} disabled={loading}>
            <RefreshCw size={14} />
            {t('service.console.refresh')}
          </button>
        </ConsoleNotice>
      );
    }
  }

  return (
    <div className={`console${full ? ' full' : ''}`}>
      <div className="console-bar">
        <button type="button" className="console-replica" onClick={(e) => pop.toggle(e.currentTarget)} aria-haspopup="menu" aria-expanded={pop.isOpen}>
          <span className="mono">{currentPod ?? t('service.console.pickReplica')}</span>
          <ChevronDown size={14} />
        </button>
        <Popover anchor={pop.anchor} onClose={pop.close} width={280}>
          {pods && pods.length > 0 ? <PodList pods={pods} selected={currentPod ?? undefined} onSelect={selectPod} className="menu-item console-menu-pod" /> : <div className="menu-label">{t('service.console.noReplicas')}</div>}
          <button
            type="button"
            className="menu-item"
            disabled={loading}
            onClick={() => {
              pop.close();
              reloadPods();
            }}
          >
            <RefreshCw size={16} className="menu-icon" /> {t('service.console.refresh')}
          </button>
        </Popover>
        <div className="console-bar-right">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFull((v) => !v)}>
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {full ? t('service.console.exitFull') : t('service.console.full')}
          </button>
          <span className={`console-status ${statusTone}`} role="status">
            <span className="pc-dot" /> {statusLabel}
          </span>
        </div>
      </div>
      <div className="console-main">
        <div className="console-term-wrap">
          <div className="console-term" ref={hostRef} />
          {overlay && <div className="console-overlay">{overlay}</div>}
          {ended && (
            <div className={`console-banner${ended.end.kind === 'error' && !isTimeoutEnd(ended.end) ? ' error' : ''}`} role="alert">
              <span className="console-banner-text">{endText(t, ended.end)}</span>
              {action === 'refresh' && (
                <button type="button" className="btn btn-outline btn-sm" onClick={leavePod} disabled={loading}>
                  <RefreshCw size={14} />
                  {t('service.console.refresh')}
                </button>
              )}
              {action === 'reconnect' && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void connect(ended.pod)}>
                  <RotateCw size={14} />
                  {t('service.console.reconnect')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 탭                                                                   */
/* ------------------------------------------------------------------ */

/** 서비스의 실행 중인 Pod 에 셸을 연다. 서버가 열 수 있다고 한 경우에만 터미널을 만든다. */
export function ServiceConsole({ service }: { service: Service }) {
  const { t } = useI18n();
  const targetId = service.remote?.targetIds[0];
  const availability = useConsoleAvailability(service.id, targetId);
  // 열 수 있다고 했는데 세션을 받을 때 거절되는 경우(그 사이 배포가 내려감 등).
  const [lateReason, setLateReason] = useState<string | null>(null);

  if (availability.loading) return <ConsoleNotice busy title={t('service.loading')} />;
  if (availability.error) {
    return (
      <ConsoleNotice title={t('service.console.unavailable')} sub={failureText(t, availability.error)}>
        <button type="button" className="btn btn-outline btn-sm" onClick={availability.retry}>
          <RefreshCw size={14} />
          {t('service.console.retry')}
        </button>
      </ConsoleNotice>
    );
  }
  const reason = lateReason ?? (availability.available ? null : (availability.reason ?? 'UNKNOWN'));
  if (reason !== null || targetId === undefined) {
    const key: MessageKey = unavailableKey(reason ?? undefined);
    return <ConsoleNotice title={t('service.console.unavailable')} sub={t(key)} />;
  }
  return <ConsoleSession serviceId={service.id} targetId={targetId} onUnavailable={setLateReason} />;
}

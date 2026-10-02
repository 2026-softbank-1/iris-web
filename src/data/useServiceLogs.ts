import { useEffect, useMemo, useState } from 'react';
import { describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import type { LogLevel, LogLine, Service } from './mock';

/** 과거 로그를 한 번에 받는 줄 수. 서버 상한이기도 하다. */
const HISTORY_LIMIT = 1000;
/** 서비스 하나에서 들고 있는 최대 줄 수. 오래 켜 둬도 화면이 무한히 늘지 않게 오래된 줄부터 버린다. */
const MAX_LINES_PER_SERVICE = 1000;
/** 서버는 7일 안쪽만 받는다. 요청이 닿는 사이 경계를 넘지 않게 1분 비운다. */
const MAX_RANGE_MS = 7 * 86_400_000 - 60_000;
/** 서버·브라우저 시계가 어긋나 end 가 미래로 읽혀 거절당하지 않게 조금 뺀다. 빠진 구간은 스트림이 채운다. */
const CLOCK_SKEW_MS = 2000;
const RETRY_MIN_MS = 3000;
const RETRY_MAX_MS = 30_000;

/** 화면의 한 행. 스택 트레이스처럼 이어지는 줄은 앞 줄에 붙어서 message 가 여러 줄이 된다. */
export type ProjectLogLine = LogLine & { key: string; ns: string; service: string; stream: string };
type Source = { id: string; name: string; targetId: number };

// was 는 로그 레벨을 따로 주지 않아서 본문에 흔히 적는 표기만 읽는다.
// 레벨 표기: level=error, "level":"warn", [error], ERROR, WARN
// 줄 맨 앞 표기: npm error·npm warn, SyntaxError: ..., Traceback (스택 트레이스의 `at ...` 줄은 info 로 둔다)
const TAG = String.raw`(?:\blevel["']?\s*[=:]\s*["']?|\[)`;
const LEVEL_RULES: [LogLevel, RegExp][] = [
  ['error', new RegExp(String.raw`${TAG}(?:error|fatal)\b|\b(?:ERROR|FATAL)\b|^npm error\b|^\s*[\w.$]*(?:Error|Exception):|^Traceback \(most recent call last\)`)],
  ['warn', new RegExp(String.raw`${TAG}warn(?:ing)?\b|\bWARN(?:ING)?\b|^npm warn\b`)],
  ['debug', new RegExp(String.raw`${TAG}debug\b|\bDEBUG\b`)],
];
const detectLevel = (message: string): LogLevel => LEVEL_RULES.find(([, re]) => re.test(message))?.[0] ?? 'info';

const NS_PER_MS = 1_000_000n;
const nsToMs = (ns: string) => Number(BigInt(ns) / NS_PER_MS);

function toLine(source: Source, entry: api.LogEntryDto): ProjectLogLine {
  return {
    // 같은 줄이 과거 조회와 스트림에서 겹쳐 와도 하나로 합치려고 내용까지 키에 넣는다.
    key: `${source.id}/${entry.timestampNs}/${entry.pod}/${entry.message}`,
    ns: entry.timestampNs,
    ts: new Date(nsToMs(entry.timestampNs)).toISOString(),
    service: source.name,
    // 어느 컨테이너가 낸 줄인지. 서로 다른 pod 의 줄이 섞여도 이어지는 줄을 맞게 붙이려고 쓴다.
    stream: `${source.id}/${entry.pod}`,
    message: entry.message,
    level: detectLevel(entry.message),
  };
}

// 나노초 문자열은 2286년까지 19자리라서 길이가 같으니 사전순이 곧 시간순이다.
const byTime = (a: { ns: string }, b: { ns: string }) => (a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : 0);

// 앞 줄에 이어지는 줄: 공백으로 시작하거나(`    at ...`, Python `  File ...`), Caused by:·... N more 로 시작한다.
const CONTINUATION_RE = /^(?:\s+\S|Caused by:|Suppressed:|\.\.\. \d+ (?:more|common frames))/;
/** 같은 이벤트의 줄은 거의 동시에 찍힌다. 이보다 벌어지면 따로 센다. */
const MAX_GROUP_GAP_NS = 1_000_000_000n;

/** 시간순 줄에서 이어지는 줄을 같은 pod 의 앞 줄에 붙여 한 행으로 만든다. 행의 시각과 레벨은 첫 줄의 것이다. */
function groupLines(sorted: ProjectLogLine[]): ProjectLogLine[] {
  const rows: ProjectLogLine[] = [];
  const open = new Map<string, { index: number; lastNs: bigint }>();
  for (const line of sorted) {
    const ns = BigInt(line.ns);
    const head = open.get(line.stream);
    if (head && CONTINUATION_RE.test(line.message) && ns - head.lastNs <= MAX_GROUP_GAP_NS) {
      rows[head.index] = { ...rows[head.index], message: `${rows[head.index].message}\n${line.message}` };
      head.lastNs = ns;
    } else {
      open.set(line.stream, { index: rows.length, lastNs: ns });
      rows.push(line);
    }
  }
  return rows;
}

function mergeLines(current: ProjectLogLine[], incoming: ProjectLogLine[]): ProjectLogLine[] {
  const seen = new Set(current.map((l) => l.key));
  const fresh = incoming.filter((l) => !seen.has(l.key) && seen.add(l.key));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort(byTime).slice(-MAX_LINES_PER_SERVICE);
}

/**
 * 프로젝트의 서비스들의 런타임 로그. 기간만큼 과거 로그를 받은 뒤 SSE 로 새 줄을 이어 받는다.
 * live 가 꺼지면 스트림을 닫고 과거 로그만 보여준다. 기간·서비스·live 가 바뀌면 처음부터 다시 연다.
 */
export function useServiceLogs(services: Service[], { rangeMs, live }: { rangeMs: number; live: boolean }) {
  // 로그는 서비스에 배정된 타깃 단위로 조회한다. 여러 개면 첫 번째를 쓴다.
  const found = services.flatMap((s) => {
    const targetId = s.remote?.targetIds[0];
    return targetId === undefined ? [] : [{ id: s.id, name: s.name, targetId }];
  });
  const sourcesKey = found.map((s) => `${s.id}:${s.targetId}:${s.name}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sources = useMemo<Source[]>(() => found, [sourcesKey]);

  const [byService, setByService] = useState<Record<string, ProjectLogLine[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let stopped = false;
    const stops: (() => void)[] = [];
    const windowStart = Date.now() - Math.min(rangeMs, MAX_RANGE_MS);

    // 사라진 서비스와 기간 밖의 줄은 버린다. 같은 줄은 아래에서 다시 받아도 키로 합쳐진다.
    setByService((prev) => {
      const ids = new Set(sources.map((s) => s.id));
      return Object.fromEntries(
        Object.entries(prev)
          .filter(([id]) => ids.has(id))
          .map(([id, lines]) => [id, lines.filter((l) => Date.parse(l.ts) >= windowStart)]),
      );
    });
    setErrors({});
    setTruncated(false);
    setLoading(true);

    const setError = (id: string, message: string | null) =>
      setErrors((prev) => {
        if ((prev[id] ?? null) === message) return prev;
        const { [id]: _removed, ...rest } = prev;
        return message === null ? rest : { ...rest, [id]: message };
      });

    const append = (source: Source, entries: api.LogEntryDto[]) => {
      if (entries.length === 0) return;
      const lines = entries.map((e) => toLine(source, e));
      setByService((prev) => ({ ...prev, [source.id]: mergeLines(prev[source.id] ?? [], lines) }));
    };

    // 서비스 하나: 과거 로그 → SSE. 끊기면 마지막으로 받은 시각부터 다시 따라잡는다.
    const follow = (source: Source) => {
      let es: EventSource | null = null;
      let timer: number | undefined;
      let delay = RETRY_MIN_MS;
      let cursorNs: string | undefined;

      const reopenLater = (message: string, wait: number) => {
        es?.close();
        es = null;
        setError(source.id, message);
        timer = window.setTimeout(() => void connect(), wait);
      };
      const retry = (message: string) => {
        reopenLater(message, delay);
        delay = Math.min(delay * 2, RETRY_MAX_MS);
      };

      const connect = async () => {
        try {
          const start = cursorNs ? nsToMs(cursorNs) : windowStart;
          const end = Date.now() - CLOCK_SKEW_MS;
          if (start < end) {
            const res = await api.searchLogs(source.id, {
              targetId: source.targetId,
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
              limit: HISTORY_LIMIT,
            });
            if (stopped) return;
            // 과거 조회는 최신순이다. 뒤집어 넣어야 같은 시각의 줄이 찍힌 순서대로 남는다(스택 트레이스를 묶는 데 필요하다).
            append(source, [...res.entries].reverse());
            if (res.isTruncated) setTruncated(true);
            // 가장 늦은 줄 다음부터 이어 받는다. 줄이 없으면 서버 기본값(10초 전)에 맡긴다.
            const latest = res.entries.reduce<bigint | null>((max, e) => (max === null || BigInt(e.timestampNs) > max ? BigInt(e.timestampNs) : max), null);
            if (latest !== null) cursorNs = String(latest + 1n);
          }
          setError(source.id, null);
          if (!live) return;

          const stream = new EventSource(api.logStreamUrl(source.id, source.targetId, cursorNs), { withCredentials: true });
          es = stream;
          stream.addEventListener('logs', (e) => {
            const event = e as MessageEvent<string>;
            delay = RETRY_MIN_MS;
            setError(source.id, null);
            // id 는 다음 조회 시작 시각이다. 브라우저의 자동 재연결은 이 값을 Last-Event-ID 로 보낸다.
            if (event.lastEventId) cursorNs = event.lastEventId;
            append(source, JSON.parse(event.data) as api.LogEntryDto[]);
          });
          // 한 번에 보낼 양을 넘으면 서버가 스트림을 닫는다. 과거 로그 API 로 따라잡고 다시 연다.
          stream.addEventListener('overflow', () => reopenLater('Too many new logs. Catching up…', 1000));
          stream.addEventListener('error', (e) => {
            // 서버가 보낸 error 이벤트는 MessageEvent 이고, 연결 자체의 오류는 그냥 Event 다.
            if (e instanceof MessageEvent) retry('Log backend error. Reconnecting…');
            // CLOSED 면 HTTP 오류 등으로 브라우저가 재연결을 포기한 것이다. CONNECTING 이면(서버가 5분마다 끊는다) 알아서 다시 붙는다.
            else if (stream.readyState === EventSource.CLOSED) retry('Live updates disconnected. Reconnecting…');
          });
        } catch (e) {
          if (stopped) return;
          if (live) retry(describeError(e));
          else setError(source.id, describeError(e));
        }
      };

      stops.push(() => {
        window.clearTimeout(timer);
        es?.close();
      });
      return connect();
    };

    void Promise.all(sources.map(follow)).then(() => !stopped && setLoading(false));
    return () => {
      stopped = true;
      for (const stop of stops) stop();
    };
  }, [sources, rangeMs, live]);

  const lines = useMemo(() => groupLines(Object.values(byService).flat().sort(byTime)), [byService]);
  return { lines, loading, error: Object.values(errors)[0] ?? null, truncated, hasSources: sources.length > 0 };
}

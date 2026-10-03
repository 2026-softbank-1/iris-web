// 런타임 로그 줄을 화면 행으로 다듬는 순수 함수들. 프로젝트 Logs(useServiceLogs)와 배포 상세의 Deploy Logs(deploymentLogModel)가 같이 쓴다.
import type { LogLevel } from './mock';

const NS_PER_MS = 1_000_000n;
/** Unix 나노초 문자열을 밀리초로. number 로는 정밀도가 모자라서 BigInt 로 나눈다. */
export const nsToMs = (ns: string) => Number(BigInt(ns) / NS_PER_MS);

// was 는 로그 레벨을 따로 주지 않아서 본문에 흔히 적는 표기만 읽는다.
// 레벨 표기: level=error, "level":"warn", [error], ERROR, WARN
// 줄 맨 앞 표기: npm error·npm warn, SyntaxError: ..., Traceback (스택 트레이스의 `at ...` 줄은 info 로 둔다)
const TAG = String.raw`(?:\blevel["']?\s*[=:]\s*["']?|\[)`;
const LEVEL_RULES: [LogLevel, RegExp][] = [
  ['error', new RegExp(String.raw`${TAG}(?:error|fatal)\b|\b(?:ERROR|FATAL)\b|^npm error\b|^\s*[\w.$]*(?:Error|Exception):|^Traceback \(most recent call last\)`)],
  ['warn', new RegExp(String.raw`${TAG}warn(?:ing)?\b|\bWARN(?:ING)?\b|^npm warn\b`)],
  ['debug', new RegExp(String.raw`${TAG}debug\b|\bDEBUG\b`)],
];
export const detectLevel = (message: string): LogLevel => LEVEL_RULES.find(([, re]) => re.test(message))?.[0] ?? 'info';

// 앞 줄에 이어지는 줄: 공백으로 시작하거나(`    at ...`, Python `  File ...`), Caused by:·... N more 로 시작한다.
const CONTINUATION_RE = /^(?:\s+\S|Caused by:|Suppressed:|\.\.\. \d+ (?:more|common frames))/;
/** 같은 이벤트의 줄은 거의 동시에 찍힌다. 이보다 벌어지면 따로 센다. */
const MAX_GROUP_GAP_NS = 1_000_000_000n;

/** 묶을 줄이 가져야 할 값. ns 는 Unix 나노초 문자열, stream 은 같은 컨테이너의 줄을 알아보는 값(pod 등)이다. */
export type GroupableLine = { ns: string; stream: string; message: string };

/** 시간순 줄에서 이어지는 줄을 같은 stream 의 앞 줄에 붙여 한 행으로 만든다. 행의 시각과 레벨은 첫 줄의 것이다. */
export function groupLines<T extends GroupableLine>(sorted: T[]): T[] {
  const rows: T[] = [];
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

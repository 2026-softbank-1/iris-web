// 서비스 Metrics 탭의 순수 계산: 기간 → 조회 창, 응답 → 선(line), 단위 변환, Y·X축 눈금, 집계 대기 구간.
// 네트워크와 화면에 기대지 않아서(타입 import 만 쓴다) 가짜 응답으로 따로 확인할 수 있다.
import type { MetricPointDto, MetricSeriesDto } from '../lib/endpoints';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * 화면에서 고르는 기간. step 은 한 기간에 점이 1,440개를 넘지 않게(서버 상한) 정한 조회 간격(초)이다.
 * trafficStep 은 트래픽 지표용이다. 그쪽 API 는 step 이 60초 이상이어야 해서 15분도 60초다.
 */
export type MetricRange = { label: string; ms: number; step: number; trafficStep: number };
export const METRIC_RANGES: MetricRange[] = [
  { label: 'Last 15 min', ms: 15 * MIN, step: 30, trafficStep: 60 },
  { label: 'Last 1 hour', ms: HOUR, step: 60, trafficStep: 60 },
  { label: 'Last 6 hours', ms: 6 * HOUR, step: 60, trafficStep: 60 },
  { label: 'Last 1 day', ms: DAY, step: 120, trafficStep: 120 },
  { label: 'Last 7 days', ms: 7 * DAY, step: 600, trafficStep: 600 },
];

/** end 를 지금보다 조금 앞에 둔다. 시계가 어긋나 end 가 미래로 읽히면 서버가 422 로 거절한다. */
export const END_LAG_MS = 30_000;

export type MetricWindow = { startMs: number; endMs: number; stepSec: number };

export function metricWindow(range: MetricRange, nowMs: number): MetricWindow {
  const endMs = nowMs - END_LAG_MS;
  return { startMs: endMs - range.ms, endMs, stepSec: range.step };
}

/** 트래픽 지표의 조회 창. end 를 앞당기는 것까지 /metrics 와 같고 step 만 다르다. */
export function trafficWindow(range: MetricRange, nowMs: number): MetricWindow {
  return { ...metricWindow(range, nowMs), stepSec: range.trafficStep };
}

/** API 쿼리 값. start·end 는 타임존이 붙은 ISO 8601(UTC)이다. */
export const windowQuery = (w: MetricWindow) => ({
  start: new Date(w.startMs).toISOString(),
  end: new Date(w.endMs).toISOString(),
  step: w.stepSec,
});

/* ---------- 응답 → 선 ---------- */

/** t 는 ms(Date 와 같은 단위), v 는 API 단위(cores·bytes·bytes/s) 그대로다. */
export type Point = { t: number; v: number };
export type MetricName =
  | 'cpu'
  | 'memory'
  | 'network_receive'
  | 'network_transmit'
  | 'requests'
  | 'error_rate_4xx'
  | 'error_rate_5xx'
  | 'public_network_receive'
  | 'public_network_transmit'
  | 'response_time_avg'
  | 'response_time_p50'
  | 'response_time_p95';

/** timestamp 는 Unix 초(소수 가능)라서 ms 로 바꾼다. 숫자가 아닌 값은 버리고 시간순으로 정렬한다. */
export function toPoints(points: MetricPointDto[]): Point[] {
  return points
    .map((p) => ({ t: Number(p.timestamp) * 1000, v: Number(p.value) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
}

/** groupBy=total 응답에서 metric 의 합계 선. pod 이 붙은 항목은 합계가 아니라서 건너뛴다. */
export function sumPoints(series: MetricSeriesDto[] | undefined, metric: MetricName): Point[] {
  const found = series?.find((s) => s.metric === metric && !s.pod);
  return found ? toPoints(found.points) : [];
}

/** 같은 Pod 은 어느 카드에서든 같은 색이다. 쓰는 색이 모자라면 돌려 쓴다. */
export const POD_COLORS = [
  'var(--primary-strong)',
  'var(--green-soft)',
  'var(--yellow)',
  'var(--blue)',
  'var(--red)',
  '#2bc4c4',
  'var(--green)',
  '#ad871f',
];

export type ReplicaLine = { pod: string; label: string; color: string; points: Point[] };

/** Pod 이름의 마지막 조각(`web-7c9d8f6b5-x2k4q` → `x2k4q`). 구분자가 없으면 이름 전체다. */
export function podSuffix(pod: string): string {
  const i = pod.lastIndexOf('-');
  return i >= 0 && i < pod.length - 1 ? pod.slice(i + 1) : pod;
}

/** groupBy=pod 응답에서 metric 의 Pod 별 선. 이름순이라서 새로 받아도 색이 바뀌지 않는다. */
export function replicaLines(series: MetricSeriesDto[] | undefined, metric: MetricName): ReplicaLine[] {
  const pods = [...new Set((series ?? []).flatMap((s) => (s.pod ? [s.pod] : [])))].sort();
  return pods.flatMap((pod, i) => {
    const found = series?.find((s) => s.metric === metric && s.pod === pod);
    return found ? [{ pod, label: podSuffix(pod), color: POD_COLORS[i % POD_COLORS.length], points: toPoints(found.points) }] : [];
  });
}

/**
 * groupBy 를 모르는 서버는 쿼리를 무시하고 합계 형태(pod 필드 없음)를 돌려준다.
 * 항목이 있는데 pod 이 하나도 없으면 그 경우다. 항목이 아예 없으면(데이터 없음) 알 수 없으니 false 다.
 */
export const isReplicasUnsupported = (series: MetricSeriesDto[] | undefined) => !!series && series.length > 0 && !series.some((s) => s.pod);

/** 값이 빈 구간(Pod 재시작, 수집 누락)을 이어 그리지 않도록 간격이 maxGapMs 를 넘는 곳에서 끊는다. */
export function splitAtGaps(points: Point[], maxGapMs: number): Point[][] {
  const segments: Point[][] = [];
  for (const p of points) {
    const last = segments[segments.length - 1];
    if (last && p.t - last[last.length - 1].t <= maxGapMs) last.push(p);
    else segments.push([p]);
  }
  return segments;
}

export const maxValue = (lines: { points: Point[] }[]) => lines.reduce((max, l) => l.points.reduce((m, p) => Math.max(m, p.v), max), 0);

/* ---------- Y축: 0 에서 시작하는 보기 좋은 눈금 ---------- */

/**
 * cpu → vCPU, bytes → B·KB·MB·GB·TB(1024 단위), rate → B/s·KB/s·MB/s·GB/s·TB/s(1024 단위),
 * count → 개수(1000 단위 K·M), percent → %(값은 0~1 비율), duration → ms·s(값은 초).
 */
export type YKind = 'cpu' | 'bytes' | 'rate' | 'count' | 'percent' | 'duration';
export type YAxis = {
  /** 맨 위 눈금의 값(API 단위). 이 값이 차트 높이 전체다. */
  top: number;
  ticks: { value: number; label: string }[];
};

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const COUNT_UNITS = ['', 'K', 'M'];
/** 눈금 간격을 정할 때 기준으로 삼는 간격 수. 실제로는 2~4칸이 된다. */
const TARGET_INTERVALS = 4;
/** 선이 맨 위 눈금에 붙지 않도록 최댓값에 얹는 여유. */
const HEADROOM = 1.05;
/** 최댓값이 이보다 작으면 이 값을 쓴다(눈금 숫자가 끝없이 길어지는 것을 막는다). */
const MIN_MAX: Record<YKind, number> = { cpu: 0.001, bytes: 1, rate: 1, count: 1, percent: 0.001, duration: 0.001 };
/** 값이 전부 0 이거나 없을 때 보여줄 눈금 범위. */
const EMPTY_MAX: Record<YKind, number> = { cpu: 0.1, bytes: 1024 ** 2, rate: 1024, count: 10, percent: 0.01, duration: 0.1 };

const pow10 = (e: number) => (e >= 0 ? 10 ** e : 1 / 10 ** -e);

/** raw 이상인 가장 작은 1·2·5 × 10^n. 가수가 한 자리라서 소수 자릿수는 지수로 정확히 나온다. */
function niceStep(raw: number): { step: number; decimals: number } {
  let exp = Math.floor(Math.log10(raw));
  if (pow10(exp + 1) <= raw) exp++; // log10 의 부동소수 오차 보정
  else if (pow10(exp) > raw) exp--;
  const norm = raw / pow10(exp);
  let mantissa = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  if (mantissa === 10) {
    mantissa = 1;
    exp++;
  }
  return { step: mantissa * pow10(exp), decimals: Math.max(0, -exp) };
}

/** 표시 단위. divisor 는 API 단위 값을 이 단위로 바꾸는 나눗수이고, sep 은 숫자와 단위 사이에 넣는 글자다. */
type DisplayUnit = { divisor: number; unit: string; sep: string };

/** 값이 가장 큰 쪽에 맞는 표시 단위. 한 축의 눈금은 모두 같은 단위를 쓴다. */
function displayUnit(kind: YKind, max: number): DisplayUnit {
  switch (kind) {
    case 'cpu':
      return { divisor: 1, unit: 'vCPU', sep: ' ' };
    case 'percent':
      return { divisor: 0.01, unit: '%', sep: '' };
    case 'duration':
      return max >= 1 ? { divisor: 1, unit: 's', sep: ' ' } : { divisor: 0.001, unit: 'ms', sep: ' ' };
    case 'count': {
      let p = 0;
      while (p < COUNT_UNITS.length - 1 && max >= 1000 ** (p + 1)) p++;
      return { divisor: 1000 ** p, unit: COUNT_UNITS[p], sep: '' };
    }
    case 'bytes':
    case 'rate': {
      let p = 0;
      while (p < BYTE_UNITS.length - 1 && max >= 1024 ** (p + 1)) p++;
      return { divisor: 1024 ** p, unit: BYTE_UNITS[p] + (kind === 'rate' ? '/s' : ''), sep: ' ' };
    }
  }
}

export function yAxis(kind: YKind, maxV: number): YAxis {
  let max = Number.isFinite(maxV) && maxV > 0 ? Math.max(maxV, MIN_MAX[kind]) : EMPTY_MAX[kind];
  if (kind === 'percent') max = Math.min(max, 1); // 비율이라 100% 를 넘지 않는다
  const { divisor, unit, sep } = displayUnit(kind, max);
  const label = (n: number, decimals: number) => `${n.toFixed(decimals)}${sep}${unit}`;
  // 절반을 넘으면 0·25·50·75·100% 로 고정한다(1·2·5 눈금은 100% 를 넘겨 150% 까지 늘어난다).
  if (kind === 'percent' && max >= 0.5) return { top: 1, ticks: [0, 25, 50, 75, 100].map((p) => ({ value: p / 100, label: label(p, 0) })) };
  const padded = (max / divisor) * HEADROOM;
  let { step, decimals } = niceStep(padded / TARGET_INTERVALS);
  // 개수 눈금은 소수가 의미 없다.
  if (kind === 'count' && divisor === 1 && step < 1) [step, decimals] = [1, 0];
  const count = Math.max(1, Math.ceil(padded / step - 1e-9));
  const ticks = Array.from({ length: count + 1 }, (_, i) => ({ value: i * step * divisor, label: label(i * step, decimals) }));
  return { top: count * step * divisor, ticks };
}

/* ---------- 집계 대기 구간 (트래픽 지표) ---------- */

/**
 * 트래픽 지표는 약 15분 늦게 집계된다. availableUntil 이후는 비어 있는 것이 아니라 아직 모르는 구간이다.
 * all: 보이는 범위에서 집계가 끝난 부분이 한 버킷(step)도 안 된다(예: Last 15 min). partial: fromMs 부터 끝까지가 대기 구간이다.
 */
export type Pending = { kind: 'none' } | { kind: 'all' } | { kind: 'partial'; fromMs: number };

export function pendingOf(win: MetricWindow, availableUntilSec: number | null | undefined): Pending {
  // 숫자가 아니면(없음·null) 집계 시각을 모르는 것이다. Number(null) 이 0 이라 따로 거른다.
  const untilMs = typeof availableUntilSec === 'number' ? availableUntilSec * 1000 : NaN;
  if (!Number.isFinite(untilMs) || untilMs >= win.endMs) return { kind: 'none' };
  if (untilMs - win.startMs < win.stepSec * 1000) return { kind: 'all' };
  return { kind: 'partial', fromMs: untilMs };
}

/** step(초)이 몇 분인지. 요청 수는 step 길이 버킷의 합계라서 "분당"·"2분당"·"10분당" 표기에 쓴다. */
export const stepMinutes = (stepSec: number) => Math.max(1, Math.round(stepSec / 60));

/* ---------- X축 ---------- */

/** 기간 길이에 따른 눈금 간격. 차트 폭에 라벨이 겹치지 않을 만큼만 둔다. */
const tickStepMs = (spanMs: number) => (spanMs <= 15 * MIN ? 5 * MIN : spanMs <= HOUR ? 20 * MIN : spanMs <= 6 * HOUR ? 2 * HOUR : spanMs <= DAY ? 8 * HOUR : 2 * DAY);

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 실제 start~end 안에서 브라우저 시간대 기준으로 정각에 맞춘 눈금. 하루 이상이면 날짜를 함께 적는다. */
export function timeTicks(startMs: number, endMs: number): { t: number; label: string }[] {
  const stepMs = tickStepMs(endMs - startMs);
  const withDate = endMs - startMs >= DAY;
  const offset = -new Date(startMs).getTimezoneOffset() * MIN; // 시간대가 정각에서 벗어나도 로컬 정각에 맞춘다
  const ticks: { t: number; label: string }[] = [];
  for (let t = Math.ceil((startMs + offset) / stepMs) * stepMs - offset; t <= endMs; t += stepMs) {
    const d = new Date(t);
    ticks.push({ t, label: withDate ? `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}h` : `${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
  }
  return ticks;
}

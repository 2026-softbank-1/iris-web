import { Clock, LayoutGrid, Pause, Play, StretchHorizontal } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Popover, usePopover } from '../../components/ui';
import {
  METRIC_RANGES,
  isReplicasUnsupported,
  maxValue,
  pendingOf,
  replicaLines,
  splitAtGaps,
  stepMinutes,
  sumPoints,
  timeTicks,
  yAxis,
  type MetricName,
  type MetricWindow,
  type Pending,
  type Point,
  type YKind,
} from '../../data/metricsModel';
import type { Service } from '../../data/mock';
import { useServiceMetrics } from '../../data/useServiceMetrics';
import { useServiceTrafficMetrics } from '../../data/useServiceTrafficMetrics';
import { useI18n, type MessageKey } from '../../i18n';

type T = ReturnType<typeof useI18n>['t'];

// METRIC_RANGES 의 영어 라벨 → 번역 키. 모르는 라벨은 그대로 보여준다.
const RANGE_KEYS: Record<string, MessageKey> = {
  'Last 15 min': 'service.metrics.range.15m',
  'Last 1 hour': 'service.metrics.range.1h',
  'Last 6 hours': 'service.metrics.range.6h',
  'Last 1 day': 'service.metrics.range.1d',
  'Last 7 days': 'service.metrics.range.7d',
};

const CHART_HEIGHT = 299;
const NETWORK_HEIGHT = 268;
const PAD_TOP = 16; // 맨 위 눈금 라벨이 들어갈 자리
const X_LABEL_HEIGHT = 23; // 시간 라벨이 들어갈 자리
const MIN_GUTTER = 46;
const PENDING_LABEL_MIN_WIDTH = 64; // 집계 대기 구간이 이보다 좁으면 라벨은 빼고 칠만 한다
const CHAR_WIDTH = 6.6; // 11px 라벨 한 글자의 대략적인 폭. Y축 라벨 칸의 너비를 정한다.
const EGRESS_COLOR = '#ad871f';
const INGRESS_COLOR = 'var(--blue-bar)';
const ERROR_5XX_COLOR = 'var(--red)';
const ERROR_4XX_COLOR = '#f2812b';
const P50_COLOR = 'var(--blue-bar)';
const P95_COLOR = '#8a63d2';
/** 응답 시간 p50·p95 는 서버가 5분 구간 값으로 주므로, 조회 step 이 더 짧아도 점 사이가 이만큼 벌어지는 것은 결측이 아니다. */
const RESPONSE_TIME_BUCKET_SEC = 300;

/** bucketSec 은 이 선의 점이 원래 벌어져 있는 간격(초)이다. 선을 끊을 기준에 쓴다. */
type ChartLine = { key: string; color: string; points: Point[]; bucketSec?: number };

/** 요소의 실제 너비. SVG 를 viewBox 로 늘이지 않고 너비에 맞춰 그려서 글자가 찌그러지지 않게 한다. */
function useElementWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || initial);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [initial]);
  return [ref, width] as const;
}

/** 실제 값에 맞춘 눈금(0 기준)과 start~end 시간축을 쓰는 SVG 선 차트. */
function LineChart({
  lines,
  kind,
  span,
  label,
  height = CHART_HEIGHT,
  pending,
}: {
  lines: ChartLine[];
  kind: YKind;
  span: MetricWindow;
  label: string;
  height?: number;
  /** 집계가 아직 안 끝난 구간(fromMs ~ end). 비어 있는 것이 아니라 아직 모르는 구간이라 옅게 칠한다. */
  pending?: { fromMs: number; label: string };
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(354);
  const axis = useMemo(() => yAxis(kind, maxValue(lines)), [kind, lines]);
  const xTicks = useMemo(() => timeTicks(span.startMs, span.endMs), [span]);

  const left = Math.max(MIN_GUTTER, 4 + Math.max(...axis.ticks.map((t) => t.label.length)) * CHAR_WIDTH + 6);
  const right = width - 1;
  const bottom = height - X_LABEL_HEIGHT;
  const { startMs, endMs, stepSec } = span;
  const geo = useMemo(
    () => ({
      toX: (t: number) => left + ((t - startMs) / (endMs - startMs)) * Math.max(right - left, 1),
      toY: (v: number) => bottom - (v / axis.top) * (bottom - PAD_TOP),
    }),
    [left, right, bottom, startMs, endMs, axis.top],
  );

  const pendingX = pending ? Math.min(Math.max(geo.toX(pending.fromMs), left), right) : right;

  // 선은 점이 최대 1,440개라서 그대로 그린다. 폭·축·데이터가 바뀔 때만 다시 계산한다.
  const drawn = useMemo(
    () =>
      lines.map((line) => ({
        key: line.key,
        color: line.color,
        // 값이 빈 구간(Pod 재시작, 수집 누락, 요청 없는 분)은 이어 그리지 않는다.
        segments: splitAtGaps(
          line.points.filter((p) => p.t >= startMs && p.t <= endMs),
          Math.max(stepSec, line.bucketSec ?? 0) * 1000 * 1.5,
        ).map((seg) => seg.map((p) => ({ x: geo.toX(p.t), y: geo.toY(p.v) }))),
      })),
    [lines, geo, startMs, endMs, stepSec],
  );

  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={label} style={{ overflow: 'hidden' }}>
        {axis.ticks.map((t, i) => (
          <g key={t.label}>
            {i > 0 && <line x1={left} x2={right} y1={geo.toY(t.value)} y2={geo.toY(t.value)} stroke="rgba(var(--wash), 0.06)" />}
            <text x={4} y={geo.toY(t.value) - 4} className="chart-tick">
              {t.label}
            </text>
          </g>
        ))}
        <line x1={left + 0.5} x2={left + 0.5} y1={PAD_TOP} y2={bottom} stroke="rgba(var(--wash), 0.22)" />
        <line x1={left} x2={right} y1={bottom + 0.5} y2={bottom + 0.5} stroke="rgba(var(--wash), 0.08)" />
        {xTicks.map((t) => {
          const x = geo.toX(t.t);
          return (
            <text key={t.t} x={x} y={height - 3} className="chart-tick" textAnchor={x > width - 30 ? 'end' : 'middle'}>
              {t.label}
            </text>
          );
        })}
        {pending && (
          <g>
            <rect x={pendingX} y={PAD_TOP} width={Math.max(right - pendingX, 0)} height={bottom - PAD_TOP} fill="rgba(var(--wash), 0.07)">
              <title>{pending.label}</title>
            </rect>
            <line x1={pendingX} x2={pendingX} y1={PAD_TOP} y2={bottom} stroke="rgba(var(--wash), 0.3)" strokeDasharray="3 3" />
            {right - pendingX >= PENDING_LABEL_MIN_WIDTH && (
              <text x={right - 6} y={PAD_TOP + 13} className="chart-tick" textAnchor="end">
                {pending.label}
              </text>
            )}
          </g>
        )}
        {drawn.map((line) =>
          line.segments.map((seg, i) =>
            seg.length === 1 ? (
              <circle key={`${line.key}/${i}`} cx={seg[0].x} cy={seg[0].y} r={2} fill={line.color} />
            ) : (
              <polyline
                key={`${line.key}/${i}`}
                points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ),
          ),
        )}
      </svg>
    </div>
  );
}

function LegendToggle({ label, color, on, title, onClick }: { label: string; color: string; on: boolean; title?: string; onClick: () => void }) {
  return (
    <button type="button" className="metric-legend-item" aria-pressed={on} title={title} style={{ opacity: on ? 1 : 0.5 }} onClick={onClick}>
      <div>
        <span className="metric-swatch" style={on ? { background: color, borderColor: color } : { borderColor: 'var(--fg)' }} />
        <span className="metric-legend-label">{label}</span>
      </div>
    </button>
  );
}

/** 차트 대신 보여줄 안내(불러오는 중·데이터 없음·오류). */
function MetricMessage({ title, sub, minHeight = 260 }: { title: string; sub?: string; minHeight?: number }) {
  return (
    <div className="metric-empty" style={{ minHeight }}>
      <p className="metric-empty-title">{title}</p>
      {sub && <p className="metric-empty-sub">{sub}</p>}
    </div>
  );
}

type MetricsView = ReturnType<typeof useServiceMetrics>;

/** 카드가 차트 대신 보여줄 안내. 차트를 그릴 수 있으면 null. */
function messageFor(view: MetricsView, what: string, hasData: boolean, error: string | undefined, t: T) {
  if (!view.hasTarget) return { title: t('service.metrics.notYet'), sub: t('service.metrics.notDeployed') };
  if (hasData && view.window) return null;
  if (view.loading) return { title: t('service.metrics.loading') };
  if (error) return { title: t('service.metrics.loadError', { what }), sub: error };
  return { title: t('service.metrics.none', { what }), sub: t('service.metrics.noneInRange') };
}

/** CPU·Memory 카드. 범례의 Sum·Replicas 로 합계 한 줄과 Pod 별 선을 켜고 끈다. */
function ResourceCard({
  title,
  what,
  metric,
  kind,
  color,
  view,
  sumOn,
  replicasOn,
  onToggleSum,
  onToggleReplicas,
}: {
  title: string;
  what: string;
  metric: MetricName;
  kind: YKind;
  color: string;
  view: MetricsView;
  sumOn: boolean;
  replicasOn: boolean;
  onToggleSum: () => void;
  onToggleReplicas: () => void;
}) {
  const { t } = useI18n();
  const sum = useMemo(() => sumPoints(view.total.data, metric), [view.total.data, metric]);
  const replicas = useMemo(() => replicaLines(view.pods.data, metric).filter((l) => l.points.length > 0), [view.pods.data, metric]);
  // 서버가 groupBy 를 모르면(구버전) 합계만 온다. 오류로 보지 않고 합계 한 줄로 그리고 Replicas 는 쓸 수 없는 것으로 보여준다.
  const unsupported = isReplicasUnsupported(view.pods.data);
  const replicasShown = replicasOn && !unsupported && !!view.pods.data;
  // Replicas 를 못 그리는 상태(미지원·Pod 초과 등)에서는 합계를 대신 보여줘서 차트가 비지 않게 한다.
  const sumShown = sumOn || (replicasOn && !replicasShown && !view.podsLoading);

  const lines = useMemo<ChartLine[]>(
    () => [...(sumShown ? [{ key: 'sum', color, points: sum }] : []), ...(replicasShown ? replicas.map((l) => ({ key: l.pod, color: l.color, points: l.points })) : [])],
    [sumShown, sum, color, replicasShown, replicas],
  );

  const hasData = sum.length > 0 || (replicasShown && replicas.length > 0);
  const error = view.total.error ?? (replicasOn ? view.pods.error : undefined);
  const message = messageFor(view, what, hasData, error, t);

  return (
    <div className="metric-card">
      <div className="metric-head">
        <p className="metric-title">{title}</p>
        <div className="metric-legend">
          <LegendToggle label={t('service.metrics.sum')} color={color} on={sumOn} onClick={onToggleSum} />
          <LegendToggle label={t('service.metrics.replicas')} color="var(--fg)" on={replicasOn && !unsupported} title={replicasOn && unsupported ? t('service.metrics.replicasUnavailable') : undefined} onClick={onToggleReplicas} />
        </div>
      </div>
      {replicasShown && replicas.length > 0 && (
        <div className="metric-legend replicas">
          {replicas.map((l) => (
            <div key={l.pod} className="metric-legend-item static" title={l.pod}>
              <span className="metric-swatch" style={{ background: l.color, borderColor: l.color }} />
              <span className="metric-legend-label">{l.label}</span>
            </div>
          ))}
        </div>
      )}
      {!message && error && <p className="metric-note">{error}</p>}
      {message ? <MetricMessage {...message} /> : <LineChart lines={lines} kind={kind} span={view.window!} label={t('service.metrics.overTime', { title })} />}
    </div>
  );
}

type TrafficView = ReturnType<typeof useServiceTrafficMetrics>;
type TrafficLine = ChartLine & { label: string };

/**
 * 트래픽 카드가 차트 대신 보여줄 안내. 차트를 그릴 수 있으면 null.
 * 로딩 → 집계 대기(보이는 범위 전부) → 차트 → 오류 → 데이터 없음 순이다. 404(API 가 아직 없음)는 오류가 아니라 데이터 없음이다.
 */
function trafficMessage(view: TrafficView, what: string, hasData: boolean, pending: Pending, t: T) {
  if (!view.hasTarget) return { title: t('service.metrics.notYet'), sub: t('service.metrics.notDeployed') };
  if (view.loading) return { title: t('service.metrics.loading') };
  if (pending.kind === 'all') return { title: t('service.metrics.pendingAll'), sub: t('service.metrics.pendingAllSub') };
  if (hasData && view.window) return null;
  if (view.error) return { title: t('service.metrics.loadError', { what }), sub: view.error };
  return { title: t('service.metrics.none', { what }), sub: t('service.metrics.noneSub') };
}

/** 트래픽 지표 카드. 선 목록과 축 종류만 다르고 상태 구분·집계 대기 표시는 모두 같다. */
function TrafficCard({ title, what, view, lines, kind }: { title: string; what: string; view: TrafficView; lines: TrafficLine[]; kind: YKind }) {
  const { t } = useI18n();
  const pending = useMemo<Pending>(() => (view.window ? pendingOf(view.window, view.availableUntil) : { kind: 'none' }), [view.window, view.availableUntil]);
  const message = trafficMessage(view, what, lines.some((l) => l.points.length > 0), pending, t);

  return (
    <div className="metric-card flush">
      <div className="metric-head">
        <p className="metric-title">{title}</p>
      </div>
      {!message && view.error && <p className="metric-note">{view.error}</p>}
      <div className="metric-chart-300">
        {message ? (
          <MetricMessage {...message} minHeight={NETWORK_HEIGHT} />
        ) : (
          <>
            <LineChart
              height={NETWORK_HEIGHT}
              lines={lines}
              kind={kind}
              span={view.window!}
              pending={pending.kind === 'partial' ? { fromMs: pending.fromMs, label: t('service.metrics.pendingTag') } : undefined}
              label={t('service.metrics.overTime', { title })}
            />
            <div className="metric-legend bottom">
              {lines.map((l) => (
                <div key={l.key} className="metric-legend-item static">
                  <span className="metric-swatch" style={{ background: l.color, borderColor: l.color }} />
                  <span className="metric-legend-label">{l.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 요청 수. 값은 step 길이 버킷의 합계라서 범례에 "분당"·"2분당"·"10분당"을 붙인다. */
function RequestsCard({ view, stepSec }: { view: TrafficView; stepSec: number }) {
  const { t } = useI18n();
  const minutes = stepMinutes(stepSec);
  const unit = minutes === 1 ? t('service.metrics.perMin') : t('service.metrics.perNMin', { n: minutes });
  const requests = useMemo(() => sumPoints(view.series, 'requests'), [view.series]);
  const label = `${t('service.metrics.requests')} · ${unit}`;
  const lines = useMemo<TrafficLine[]>(() => [{ key: 'requests', label, color: 'var(--blue-bar)', points: requests }], [label, requests]);
  return <TrafficCard title={t('service.metrics.requests')} what={t('service.metrics.what.request')} view={view} lines={lines} kind="count" />;
}

/** 요청 오류율. 같은 버킷의 5xx·4xx 응답 수 ÷ 요청 수(0~1)이고 축은 %다. */
function ErrorRateCard({ view }: { view: TrafficView }) {
  const { t } = useI18n();
  const e5 = useMemo(() => sumPoints(view.series, 'error_rate_5xx'), [view.series]);
  const e4 = useMemo(() => sumPoints(view.series, 'error_rate_4xx'), [view.series]);
  const lines = useMemo<TrafficLine[]>(
    () => [
      { key: '5xx', label: '5xx', color: ERROR_5XX_COLOR, points: e5 },
      { key: '4xx', label: '4xx', color: ERROR_4XX_COLOR, points: e4 },
    ],
    [e5, e4],
  );
  return <TrafficCard title={t('service.metrics.errorRate')} what={t('service.metrics.what.errorRate')} view={view} lines={lines} kind="percent" />;
}

/** 응답 시간 p50·p95(평균은 그리지 않는다). 5분 구간 값이라 받은 점을 그대로 그리고 더 긴 구간으로 합치지 않는다. */
function ResponseTimeCard({ view }: { view: TrafficView }) {
  const { t } = useI18n();
  const p50 = useMemo(() => sumPoints(view.series, 'response_time_p50'), [view.series]);
  const p95 = useMemo(() => sumPoints(view.series, 'response_time_p95'), [view.series]);
  const lines = useMemo<TrafficLine[]>(
    () => [
      { key: 'p50', label: 'p50', color: P50_COLOR, points: p50, bucketSec: RESPONSE_TIME_BUCKET_SEC },
      { key: 'p95', label: 'p95', color: P95_COLOR, points: p95, bucketSec: RESPONSE_TIME_BUCKET_SEC },
    ],
    [p50, p95],
  );
  return <TrafficCard title={t('service.metrics.responseTime')} what={t('service.metrics.what.responseTime')} view={view} lines={lines} kind="duration" />;
}

/** 공개 네트워크 트래픽: ALB 를 지나는 송신·수신 평균 bytes/s. Pod 전체 네트워크(/metrics)가 아니다. */
function PublicNetworkCard({ view }: { view: TrafficView }) {
  const { t } = useI18n();
  const transmit = useMemo(() => sumPoints(view.series, 'public_network_transmit'), [view.series]);
  const receive = useMemo(() => sumPoints(view.series, 'public_network_receive'), [view.series]);
  const egress = t('service.metrics.egress');
  const ingress = t('service.metrics.ingress');
  const lines = useMemo<TrafficLine[]>(
    () => [
      { key: 'egress', label: egress, color: EGRESS_COLOR, points: transmit },
      { key: 'ingress', label: ingress, color: INGRESS_COLOR, points: receive },
    ],
    [egress, ingress, transmit, receive],
  );
  return <TrafficCard title={t('service.metrics.network')} what={t('service.metrics.what.network')} view={view} lines={lines} kind="rate" />;
}

export function ServiceMetrics({ service }: { service: Service }) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<'grid' | 'rows'>('grid');
  const rangeLabel = (label: string) => (RANGE_KEYS[label] ? t(RANGE_KEYS[label]) : label);
  const [range, setRange] = useState(0);
  const [live, setLive] = useState(true);
  const [sum, setSum] = useState({ cpu: true, memory: true });
  const [replicas, setReplicas] = useState({ cpu: false, memory: false });
  const rangePop = usePopover();

  // Pod 별 조회는 Replicas 가 켜진 카드가 있을 때만 한다.
  const view = useServiceMetrics(service, { range, live, replicas: replicas.cpu || replicas.memory });
  // 트래픽 지표는 요청·로딩·오류가 따로라서 이쪽이 실패해도 CPU·Memory 차트는 그대로다.
  const traffic = useServiceTrafficMetrics(service, { range, live });
  const toggle = (set: typeof setSum, name: 'cpu' | 'memory') => set((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="metrics">
      <div className="metrics-bar">
        <div role="group" className="metric-layout">
          <button type="button" role="radio" data-state={layout === 'rows' ? 'on' : 'off'} onClick={() => setLayout('rows')}>
            <div className="tool-icon">
              <StretchHorizontal size={20} />
            </div>
          </button>
          <button type="button" role="radio" data-state={layout === 'grid' ? 'on' : 'off'} onClick={() => setLayout('grid')}>
            <div className="tool-icon">
              <LayoutGrid size={20} />
            </div>
          </button>
        </div>
        <div className="metrics-bar-right">
          <button type="button" className="btn btn-outline" onClick={(e) => rangePop.toggle(e.currentTarget)}>
            <div className="tool-icon dim">
              <Clock size={16} />
            </div>
            <span>{rangeLabel(METRIC_RANGES[range].label)}</span>
          </button>
          <Popover anchor={rangePop.anchor} onClose={rangePop.close} align="end" width={180}>
            {METRIC_RANGES.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className="menu-item"
                data-active={i === range}
                onClick={() => {
                  setRange(i);
                  rangePop.close();
                }}
              >
                {rangeLabel(r.label)}
              </button>
            ))}
          </Popover>
          <button type="button" title={live ? t('service.metrics.pause') : t('service.metrics.resume')} className={`btn btn-icon-only live-btn${live ? '' : ' paused'}`} onClick={() => setLive((v) => !v)}>
            <div className="tool-icon">{live ? <Pause size={16} /> : <Play size={16} />}</div>
          </button>
        </div>
      </div>
      <div className={`metrics-grid${layout === 'rows' ? ' rows' : ''}`}>
        <ResourceCard
          title="CPU"
          what="CPU"
          metric="cpu"
          kind="cpu"
          color="var(--blue-bar)"
          view={view}
          sumOn={sum.cpu}
          replicasOn={replicas.cpu}
          onToggleSum={() => toggle(setSum, 'cpu')}
          onToggleReplicas={() => toggle(setReplicas, 'cpu')}
        />
        <ResourceCard
          title={t('service.metrics.memory')}
          what={t('service.metrics.what.memory')}
          metric="memory"
          kind="bytes"
          color="var(--primary)"
          view={view}
          sumOn={sum.memory}
          replicasOn={replicas.memory}
          onToggleSum={() => toggle(setSum, 'memory')}
          onToggleReplicas={() => toggle(setReplicas, 'memory')}
        />
        <PublicNetworkCard view={traffic} />
        <RequestsCard view={traffic} stepSec={METRIC_RANGES[range].trafficStep} />
        <ErrorRateCard view={traffic} />
        <ResponseTimeCard view={traffic} />
      </div>
    </div>
  );
}

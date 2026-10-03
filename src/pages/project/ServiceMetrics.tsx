import { Clock, LayoutGrid, Pause, Play, StretchHorizontal } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Popover, usePopover } from '../../components/ui';
import {
  METRIC_RANGES,
  isReplicasUnsupported,
  maxValue,
  replicaLines,
  splitAtGaps,
  sumPoints,
  timeTicks,
  yAxis,
  type MetricName,
  type MetricWindow,
  type Point,
  type YKind,
} from '../../data/metricsModel';
import type { Service } from '../../data/mock';
import { useServiceMetrics } from '../../data/useServiceMetrics';
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
const CHAR_WIDTH = 6.6; // 11px 라벨 한 글자의 대략적인 폭. Y축 라벨 칸의 너비를 정한다.
const EGRESS_COLOR = '#ad871f';
const INGRESS_COLOR = 'var(--blue-bar)';

type ChartLine = { key: string; color: string; points: Point[] };

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
function LineChart({ lines, kind, span, label, height = CHART_HEIGHT }: { lines: ChartLine[]; kind: YKind; span: MetricWindow; label: string; height?: number }) {
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

  // 선은 점이 최대 1,440개라서 그대로 그린다. 폭·축·데이터가 바뀔 때만 다시 계산한다.
  const drawn = useMemo(
    () =>
      lines.map((line) => ({
        key: line.key,
        color: line.color,
        // 값이 빈 구간(Pod 재시작, 수집 누락)은 이어 그리지 않는다.
        segments: splitAtGaps(
          line.points.filter((p) => p.t >= startMs && p.t <= endMs),
          stepSec * 1000 * 1.5,
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

function EmptyMetric({ title, what, tall }: { title: string; what: string; tall?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="metric-card flush">
      <p className="metric-title">{title}</p>
      <div className="metric-empty" style={{ minHeight: tall ? 300 : 260 }}>
        <p className="metric-empty-title">{t('service.metrics.none', { what })}</p>
        <p className="metric-empty-sub">{t('service.metrics.noneSub')}</p>
      </div>
    </div>
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

/** Pod 의 네트워크 rate. 공용 트래픽만 따로 가른 값이 아니다. */
function NetworkCard({ view }: { view: MetricsView }) {
  const { t } = useI18n();
  const egress = useMemo(() => sumPoints(view.total.data, 'network_transmit'), [view.total.data]);
  const ingress = useMemo(() => sumPoints(view.total.data, 'network_receive'), [view.total.data]);
  const lines = useMemo<ChartLine[]>(
    () => [
      { key: 'egress', color: EGRESS_COLOR, points: egress },
      { key: 'ingress', color: INGRESS_COLOR, points: ingress },
    ],
    [egress, ingress],
  );
  const message = messageFor(view, t('service.metrics.what.network'), egress.length > 0 || ingress.length > 0, view.total.error, t);

  return (
    <div className="metric-card flush">
      <div className="metric-head">
        <p className="metric-title">{t('service.metrics.network')}</p>
      </div>
      {!message && view.total.error && <p className="metric-note">{view.total.error}</p>}
      <div className="metric-chart-300">
        {message ? (
          <MetricMessage {...message} minHeight={NETWORK_HEIGHT} />
        ) : (
          <>
            <LineChart height={NETWORK_HEIGHT} lines={lines} kind="rate" span={view.window!} label={t('service.metrics.overTime', { title: t('service.metrics.network') })} />
            <div className="metric-legend bottom">
              <div className="metric-legend-item static" style={{ color: EGRESS_COLOR }}>
                <span className="metric-swatch" style={{ background: EGRESS_COLOR, borderColor: EGRESS_COLOR }} />
                <span className="metric-legend-label">{t('service.metrics.egress')}</span>
              </div>
              <div className="metric-legend-item static">
                <span className="metric-swatch" style={{ background: INGRESS_COLOR, borderColor: INGRESS_COLOR }} />
                <span className="metric-legend-label">{t('service.metrics.ingress')}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
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
        <NetworkCard view={view} />
        <EmptyMetric title={t('service.metrics.requests')} what={t('service.metrics.what.request')} tall />
        <EmptyMetric title={t('service.metrics.errorRate')} what={t('service.metrics.what.errorRate')} />
        <EmptyMetric title={t('service.metrics.responseTime')} what={t('service.metrics.what.responseTime')} />
      </div>
    </div>
  );
}

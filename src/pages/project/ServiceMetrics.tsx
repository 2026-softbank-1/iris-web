import { Clock, LayoutGrid, Pause, Play, StretchHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Popover, usePopover } from '../../components/ui';
import type { Service } from '../../data/mock';

const RANGES = ['Last 15 min', 'Last 1 hour', 'Last 6 hours', 'Last 1 day', 'Last 7 days'];
const RANGE_MIN = [15, 60, 360, 1440, 10080];

interface Series {
  color: string;
  /** values sampled evenly across the time range */
  values: number[];
}

const W = 354;
const AXIS_X = 46;
const STEP = 55.3; // px between major ticks

/** Small hand-rolled SVG line chart tuned to the original's proportions. */
function LineChart({
  series,
  ticks,
  tickValue,
  xTicks,
  height = 299,
  centered = false,
}: {
  series: Series[];
  ticks: string[]; // labels from the baseline upwards
  tickValue: number; // value represented by one major step
  xTicks: { label: string; x: number }[];
  height?: number;
  centered?: boolean; // zero line in the middle (no data range yet)
}) {
  const bottom = centered ? 121.5 : 276;
  const plotRight = W - 1;
  const toY = (v: number) => bottom - (v / tickValue) * STEP;
  const minor: number[] = [];
  if (!centered) for (let y = bottom - STEP / 2; y > 4; y -= STEP / 2) minor.push(y);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} className="chart" style={{ overflow: 'hidden' }}>
      {minor.map((y) => (
        <line key={y} x1={AXIS_X} x2={plotRight} y1={y} y2={y} stroke="rgba(255,255,255,0.035)" />
      ))}
      {ticks.map((t, i) => (
        <text key={t + i} x={4} y={(centered ? bottom - 3 : toY(i * tickValue) - 4) } className="chart-tick">
          {t}
        </text>
      ))}
      {!centered && (
        <>
          <line x1={AXIS_X + 0.5} x2={AXIS_X + 0.5} y1={0} y2={bottom} stroke="rgba(255,255,255,0.22)" />
          <line x1={AXIS_X} x2={plotRight} y1={bottom + 0.5} y2={bottom + 0.5} stroke="rgba(255,255,255,0.08)" />
        </>
      )}
      {!centered &&
        xTicks.map((t) => (
          <text key={t.label} x={t.x} y={296} className="chart-tick" textAnchor="middle">
            {t.label}
          </text>
        ))}
      {series.map((s, si) => {
        const n = s.values.length;
        const pts = s.values.map((v, i) => `${AXIS_X + (i / (n - 1)) * (plotRight - AXIS_X)},${toY(v)}`);
        // the line "rises" from the baseline when the replica started
        const first = `${AXIS_X},${bottom}`;
        return <polyline key={si} points={[first, ...pts].join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />;
      })}
    </svg>
  );
}

function Legend({ items }: { items: { label: string; color: string; hollow?: boolean; dim?: boolean }[] }) {
  return (
    <div className="metric-legend">
      {items.map((it) => (
        <button key={it.label} type="button" className="metric-legend-item" style={{ opacity: it.dim ? 0.5 : 1 }}>
          <div>
            <span className="metric-swatch" style={it.hollow ? { borderColor: '#fff' } : { background: it.color, borderColor: it.color }} />
            <span className="metric-legend-label">{it.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyMetric({ title, what, tall }: { title: string; what: string; tall?: boolean }) {
  return (
    <div className="metric-card flush">
      <p className="metric-title">{title}</p>
      <div className="metric-empty" style={{ minHeight: tall ? 300 : 260 }}>
        <p className="metric-empty-title">No {what} metrics available</p>
        <p className="metric-empty-sub">They will show up here once your service starts receiving traffic</p>
      </div>
    </div>
  );
}

export function ServiceMetrics({ service }: { service: Service }) {
  const [layout, setLayout] = useState<'grid' | 'rows'>('grid');
  const [range, setRange] = useState(0);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const rangePop = usePopover();

  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, [live]);

  const xTicks = useMemo(() => {
    const mins = RANGE_MIN[range];
    const stepMin = mins <= 15 ? 5 : mins <= 60 ? 20 : mins <= 360 ? 120 : mins <= 1440 ? 480 : 2880;
    const end = now.getTime();
    const start = end - mins * 60_000;
    const out: { label: string; x: number }[] = [];
    let t = Math.ceil(start / (stepMin * 60_000)) * stepMin * 60_000;
    for (; t <= end + stepMin * 60_000 * 0.4; t += stepMin * 60_000) {
      const d = new Date(t);
      const label =
        mins >= 1440 ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h` : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      out.push({ label, x: AXIS_X + ((t - start) / (end - start)) * (W - 1 - AXIS_X) });
    }
    return out;
  }, [now, range]);

  const online = service.state === 'online';
  const flat = (v: number, n = 60) => Array.from({ length: n }, () => (online ? v : 0));

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
            <span>{RANGES[range]}</span>
          </button>
          <Popover anchor={rangePop.anchor} onClose={rangePop.close} align="end" width={180}>
            {RANGES.map((r, i) => (
              <button
                key={r}
                type="button"
                className="menu-item"
                data-active={i === range}
                onClick={() => {
                  setRange(i);
                  rangePop.close();
                }}
              >
                {r}
              </button>
            ))}
          </Popover>
          <button type="button" title={live ? 'Pause live updates' : 'Resume live updates'} className={`btn btn-icon-only live-btn${live ? '' : ' paused'}`} onClick={() => setLive((v) => !v)}>
            <div className="tool-icon">{live ? <Pause size={16} /> : <Play size={16} />}</div>
          </button>
        </div>
      </div>
      <div className={`metrics-grid${layout === 'rows' ? ' rows' : ''}`}>
        <div className="metric-card">
          <div className="metric-head">
            <p className="metric-title">CPU</p>
            <Legend
              items={[
                { label: 'Sum', color: 'var(--purple)' },
                { label: 'Replicas', color: '#fff', hollow: true, dim: true },
              ]}
            />
          </div>
          <LineChart
            ticks={['0.0 vCPU', '0.2 vCPU', '0.4 vCPU', '0.6 vCPU', '0.8 vCPU']}
            tickValue={0.2}
            xTicks={xTicks}
            series={[{ color: 'var(--blue-bar)', values: flat(0.002) }]}
          />
        </div>
        <div className="metric-card">
          <div className="metric-head">
            <p className="metric-title">Memory</p>
            <Legend
              items={[
                { label: 'Sum', color: 'var(--purple)' },
                { label: 'Replicas', color: '#fff', hollow: true, dim: true },
              ]}
            />
          </div>
          <LineChart
            ticks={['0 B', '100 MB', '200 MB', '300 MB', '400 MB']}
            tickValue={100}
            xTicks={xTicks}
            series={[{ color: 'var(--purple)', values: flat(38) }]}
          />
        </div>
        <div className="metric-card flush">
          <div className="metric-head">
            <p className="metric-title">Public Network Traffic</p>
          </div>
          <div className="metric-chart-300">
          <LineChart
            height={268}
            centered
            ticks={['0 B']}
            tickValue={1}
            xTicks={[]}
            series={[
              { color: '#ad871f', values: flat(0) },
              { color: 'var(--blue-bar)', values: flat(0) },
            ]}
          />
          <div className="metric-legend bottom">
            <div className="metric-legend-item static" style={{ color: '#ad871f' }}>
              <span className="metric-swatch" style={{ background: '#ad871f', borderColor: '#ad871f' }} />
              <span className="metric-legend-label">Egress</span>
            </div>
            <div className="metric-legend-item static">
              <span className="metric-swatch" style={{ background: 'var(--blue-bar)', borderColor: 'var(--blue-bar)' }} />
              <span className="metric-legend-label">Ingress</span>
            </div>
          </div>
          </div>
        </div>
        <EmptyMetric title="Requests" what="request" tall />
        <EmptyMetric title="Request Error Rate" what="error rate" />
        <EmptyMetric title="Response Time" what="response time" />
      </div>
    </div>
  );
}

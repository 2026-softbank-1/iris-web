import { ArrowDown, ArrowUp, Clock, Download, Pause, Play, Search, Settings } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Popover, usePopover, useUI } from '../../components/ui';
import { fmtKst, fmtKstFull } from '../../data/mock';
import { useProject } from '../../data/ProjectsContext';
import { useServiceLogs } from '../../data/useServiceLogs';

const MIN = 60_000;
const RANGES = [
  { label: 'Last 15 min', ms: 15 * MIN },
  { label: 'Last 1 hour', ms: 60 * MIN },
  { label: 'Last 6 hours', ms: 6 * 60 * MIN },
  { label: 'Last 1 day', ms: 24 * 60 * MIN },
  { label: 'Last 7 days', ms: 7 * 24 * 60 * MIN },
];

export function ProjectLogs() {
  const { projectId } = useParams();
  // ProjectLayout 이 프로젝트가 있을 때만 이 페이지를 그린다.
  const project = useProject(projectId).project!;
  const { toast } = useUI();
  const [q, setQ] = useState('');
  const [live, setLive] = useState(true);
  const [range, setRange] = useState(0);
  const rangePop = usePopover();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { lines: all, loading, error, truncated, hasSources } = useServiceLogs(project.services, { rangeMs: RANGES[range].ms, live });
  const lines = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((l) => !query || l.message.toLowerCase().includes(query) || l.service.toLowerCase().includes(query));
  }, [all, q]);

  // 맨 아래를 보고 있을 때만 새 줄을 따라간다. 위로 올려 읽는 중이면 그대로 둔다.
  const followTail = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && followTail.current) el.scrollTop = el.scrollHeight;
  }, [lines, error]);

  const now = new Date();
  const from = new Date(now.getTime() - RANGES[range].ms);
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="proj-page-region">
      <div className="proj-frame plogs">
        <div className="plogs-bar">
          <div className="plogs-filter">
            <Search size={16} />
            <input ref={inputRef} placeholder="Filter and search logs" value={q} onChange={(e) => setQ(e.target.value)} />
            {!q && (
              <span className="plogs-kbd" onClick={() => inputRef.current?.focus()}>
                /
              </span>
            )}
          </div>
          <button type="button" className="btn btn-outline btn-icon-only" title="Download logs" onClick={() => toast('Logs downloaded (mock)')}>
            <div className="tool-icon">
              <Download size={16} />
            </div>
          </button>
          <button type="button" className="btn btn-outline" onClick={(e) => rangePop.toggle(e.currentTarget)}>
            <div className="tool-icon">
              <Clock size={16} />
            </div>
            <span>{RANGES[range].label}</span>
          </button>
          <Popover anchor={rangePop.anchor} onClose={rangePop.close} align="end" width={180}>
            {RANGES.map((r, i) => (
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
                {r.label}
              </button>
            ))}
          </Popover>
          <button type="button" title={live ? 'Pause live updates' : 'Resume'} className={`btn btn-icon-only live-btn${live ? '' : ' paused'}`} onClick={() => setLive((v) => !v)}>
            <div className="tool-icon">{live ? <Pause size={16} /> : <Play size={16} />}</div>
          </button>
        </div>
        <div className="plogs-hist">
          <div className="plogs-hist-track">
            <div className="plogs-hist-bar" style={{ left: '45.5%' }} />
          </div>
          <div className="plogs-hist-labels">
            <span>{hhmm(from)}</span>
            <span>{hhmm(now)}</span>
          </div>
        </div>
        <div className="plogs-table">
          <div className="plogs-head">
            <span>Time (GMT+9)</span>
            <span>Service</span>
            <span>Data</span>
            <button type="button" className="logs-layout-btn" title="Layout settings">
              <div className="tool-icon">
                <Settings size={16} />
              </div>
            </button>
          </div>
          <div
            className="plogs-scroll"
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              followTail.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
          >
            <div className="plogs-marker">
              <div className="plogs-marker-pill">
                {truncated ? 'Showing only the latest lines' : 'You reached the start of the range'} <span className="plogs-arrow">→</span>{' '}
                <span className="mono-ish">{fmtKst(from.toISOString(), false)}</span>
              </div>
            </div>
            {lines.length === 0 && (
              <div className="logs-empty">
                {q && all.length > 0
                  ? `No logs match “${q}”`
                  : loading
                    ? 'Loading logs…'
                    : error ?? (hasSources ? 'No logs in this time range' : "Logs aren't available yet")}
              </div>
            )}
            {lines.map((l) => (
              <div key={l.key} className={`plogs-row level-${l.level}`}>
                <span className="plogs-time">
                  <span className={`log-level ${l.level}`} />
                  <time title={fmtKstFull(l.ts)}>{fmtKst(l.ts)}</time>
                </span>
                <span className="plogs-svc">{l.service}</span>
                <span className="plogs-msg">{l.message}</span>
              </div>
            ))}
            {error && lines.length > 0 && (
              <div className="plogs-marker">
                <div className="plogs-marker-pill">{error}</div>
              </div>
            )}
          </div>
          <div className="plogs-jump">
            <button type="button" className="btn btn-outline btn-icon-only" aria-label="Scroll to top" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn btn-outline btn-icon-only" aria-label="Scroll to bottom" onClick={() => scrollRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' })}>
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

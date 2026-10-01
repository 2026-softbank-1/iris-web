import { ArrowDown, ArrowUp, Clock, Download, Pause, Play, Search, Settings } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Popover, usePopover, useUI } from '../../components/ui';
import { fmtKst, fmtKstFull, getProject, type LogLine } from '../../data/mock';

const RANGES = ['Last 15 min', 'Last 1 hour', 'Last 6 hours', 'Last 1 day', 'Last 7 days'];

export function ProjectLogs() {
  const { projectId } = useParams();
  const project = getProject(projectId)!;
  const { toast } = useUI();
  const [q, setQ] = useState('');
  const [live, setLive] = useState(true);
  const [range, setRange] = useState(0);
  const rangePop = usePopover();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recent environment logs: crashed services report a container stop, live ones their latest lines.
  const lines = useMemo(() => {
    const out: (LogLine & { service: string })[] = [];
    for (const s of project.services) {
      if (s.state === 'online') {
        const d = s.deployments.find((x) => x.status === 'ACTIVE');
        d?.deployLogs.slice(-3).forEach((l) => out.push({ ...l, service: s.name }));
      } else {
        out.push({ ts: '2026-10-01T21:01:27.000+09:00', message: 'Stopping Container', level: 'info', service: s.name });
      }
    }
    const query = q.trim().toLowerCase();
    return out.filter((l) => !query || l.message.toLowerCase().includes(query) || l.service.toLowerCase().includes(query));
  }, [project, q]);

  const now = new Date();
  const from = new Date(now.getTime() - 15 * 60_000);
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
          <div className="plogs-scroll" ref={scrollRef}>
            <div className="plogs-marker">
              <div className="plogs-marker-pill">
                You reached the start of the range <span className="plogs-arrow">→</span> <span className="mono-ish">{fmtKst(from.toISOString(), false)}</span>
              </div>
            </div>
            {lines.length === 0 && <div className="logs-empty">No logs match “{q}”</div>}
            {lines.map((l, i) => (
              <div key={i} className={`plogs-row level-${l.level}`}>
                <span className="plogs-time">
                  <span className={`log-level ${l.level}`} />
                  <time title={fmtKstFull(l.ts)}>{fmtKst(l.ts)}</time>
                </span>
                <span className="plogs-svc">{l.service}</span>
                <span className="plogs-msg">{l.message}</span>
              </div>
            ))}
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

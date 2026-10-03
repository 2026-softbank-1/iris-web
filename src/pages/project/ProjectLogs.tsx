import { ArrowDown, ArrowUp, Clock, Download, Pause, Play, Search, Settings } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Popover, usePopover, useUI } from '../../components/ui';
import { fmtKst, fmtKstFull } from '../../data/mock';
import { useProject } from '../../data/ProjectsContext';
import { useServiceLogs } from '../../data/useServiceLogs';
import { useI18n, type MessageKey } from '../../i18n';

const MIN = 60_000;
const RANGES: { label: MessageKey; ms: number }[] = [
  { label: 'project.logs.range15m', ms: 15 * MIN },
  { label: 'project.logs.range1h', ms: 60 * MIN },
  { label: 'project.logs.range6h', ms: 6 * 60 * MIN },
  { label: 'project.logs.range1d', ms: 24 * 60 * MIN },
  { label: 'project.logs.range7d', ms: 7 * 24 * 60 * MIN },
];

export function ProjectLogs() {
  const { projectId } = useParams();
  // ProjectLayout 이 프로젝트가 있을 때만 이 페이지를 그린다.
  const project = useProject(projectId).project!;
  const { toast } = useUI();
  const { t } = useI18n();
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
            <input ref={inputRef} placeholder={t('project.logs.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
            {!q && (
              <span className="plogs-kbd" onClick={() => inputRef.current?.focus()}>
                /
              </span>
            )}
          </div>
          <button type="button" className="btn btn-outline btn-icon-only" title={t('project.logs.download')} onClick={() => toast(t('project.logs.downloaded'))}>
            <div className="tool-icon">
              <Download size={16} />
            </div>
          </button>
          <button type="button" className="btn btn-outline" onClick={(e) => rangePop.toggle(e.currentTarget)}>
            <div className="tool-icon">
              <Clock size={16} />
            </div>
            <span>{t(RANGES[range].label)}</span>
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
                {t(r.label)}
              </button>
            ))}
          </Popover>
          <button type="button" title={live ? t('project.logs.pauseLive') : t('project.logs.resume')} className={`btn btn-icon-only live-btn${live ? '' : ' paused'}`} onClick={() => setLive((v) => !v)}>
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
            <span>{t('project.logs.colTime')}</span>
            <span>{t('project.logs.colService')}</span>
            <span>{t('project.logs.colData')}</span>
            <button type="button" className="logs-layout-btn" title={t('project.logs.layoutSettings')}>
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
                {truncated ? t('project.logs.truncated') : t('project.logs.rangeStart')} <span className="plogs-arrow">→</span>{' '}
                <span className="mono-ish">{fmtKst(from.toISOString(), false)}</span>
              </div>
            </div>
            {lines.length === 0 && (
              <div className="logs-empty">
                {q && all.length > 0
                  ? t('project.logs.noMatch', { q })
                  : loading
                    ? t('project.logs.loading')
                    : error ?? (hasSources ? t('project.logs.emptyRange') : t('project.logs.unavailable'))}
              </div>
            )}
            {lines.map((l) => (
              <div key={l.key} className={`plogs-row level-${l.level}${l.message.includes('\n') ? ' block' : ''}`}>
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
            <button type="button" className="btn btn-outline btn-icon-only" aria-label={t('project.logs.scrollTop')} onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn btn-outline btn-icon-only" aria-label={t('project.logs.scrollBottom')} onClick={() => scrollRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' })}>
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

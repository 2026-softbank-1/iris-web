import { ArrowDown, ArrowRight, ArrowUp, Check, Download, ExternalLink, Search, Settings, ChevronRight, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Popover, usePopover } from '../../components/ui';
import { fmtKst, fmtKstFull, type LogLine } from '../../data/mock';
import { useI18n } from '../../i18n';

function LevelBar({ level }: { level: LogLine['level'] }) {
  return (
    <button type="button" className="log-level-btn" tabIndex={-1}>
      <div className={`log-level ${level}`} />
    </button>
  );
}

function RangeMarker({ label, time }: { label: string; time: string }) {
  return (
    <div className="logs-marker">
      <div className="logs-marker-line">
        <div className="logs-marker-anchor">
          <div className="logs-marker-pill">
            {label}{' '}
            <span className="logs-marker-arrow" aria-hidden>
              <ArrowRight size={12} />
            </span>{' '}
            <time>{time}</time>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuildRow({ line }: { line: LogLine }) {
  const [open, setOpen] = useState(false);
  const hasOutput = !!line.output?.length;
  const m = line.message.match(/^\[([^\]]+)\]\s*(.*)$/);
  const stage = m?.[1];
  const text = m ? m[2] : line.message;
  const size = line.attrs?.[0]?.value;
  const toggle = () => hasOutput && setOpen((v) => !v);
  const icon = (
    <div className="bl-icon">{hasOutput ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : <Check size={12} strokeWidth={2.5} />}</div>
  );

  if (!line.step) {
    return (
      <div className="bl-plain">
        <span>{text}</span>
        {size && <span className="bl-size">{size}</span>}
      </div>
    );
  }

  if (size) {
    return (
      <div className="bl-flex">
        {icon}
        <span>{text}</span>
        <span className="bl-size">{size}</span>
        <span className="bl-dur">{line.duration}</span>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="bl-step" onClick={toggle} style={{ cursor: hasOutput ? 'pointer' : 'default' }}>
        <div className={`bl-grid${stage ? '' : ' no-stage'}`}>
          {stage ? (
            <div className="bl-stage">
              {icon}
              <div className="bl-stage-name">{stage}</div>
            </div>
          ) : (
            <div className="bl-stage-empty">{hasOutput && icon}</div>
          )}
          <div className={`bl-text${line.cached ? ' cached' : ''}`}>
            {text}
            {line.cached && <span className="bl-cached"> cached</span>}
          </div>
          <div className="bl-dur-cell">
            <time>{line.duration}</time>
          </div>
        </div>
      </button>
      {open && hasOutput && (
        <div className="log-step-output">
          {line.output!.map((o, i) => (
            <div key={i}>{o || '\u00a0'}</div>
          ))}
        </div>
      )}
    </>
  );
}

export function LogTable({
  lines,
  range,
  kind,
  explorerHref,
  emptyLabel,
}: {
  lines: LogLine[];
  range?: { start: string; end: string };
  kind: 'build' | 'deploy' | 'http';
  explorerHref?: string;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [wrap, setWrap] = useState(true);
  const [showAttrs, setShowAttrs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const optionsPop = usePopover();
  const layoutPop = usePopover();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return lines;
    const lv = query.match(/@level:(\w+)/);
    const text = query.replace(/@level:\w+/, '').trim();
    return lines.filter((l) => {
      if (lv && l.level !== lv[1]) return false;
      if (!text) return true;
      return l.message.toLowerCase().includes(text) || l.attrs?.some((a) => `${a.key}${a.value}`.toLowerCase().includes(text));
    });
  }, [q, lines]);

  // Logs follow the tail, like the original viewer
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  // "/" focuses the filter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dataLabel = kind === 'build' ? t('service.logs.message') : t('service.logs.data');
  const searchLabel = kind === 'build' ? t('service.logs.searchBuild') : t('service.logs.filter');

  return (
    <div className="logs">
      <div className="logs-toolbar-wrap">
        <div className={`logs-toolbar${kind === 'build' ? ' single' : ''}`}>
          <div className="logs-filter">
            <div className="logs-filter-icon">
              <Search size={16} />
            </div>
            <div className="logs-filter-field">
              {!q && <span className="logs-filter-ph">{searchLabel}</span>}
              <textarea
                ref={inputRef}
                aria-label={searchLabel}
                rows={1}
                value={q}
                spellCheck={false}
                onChange={(e) => setQ(e.target.value.replace(/\n/g, ''))}
              />
            </div>
            {!q && (
              <div className="logs-filter-kbd" title={t('service.logs.focus')} onClick={() => inputRef.current?.focus()}>
                <span>/</span>
              </div>
            )}
          </div>
          <button type="button" title={kind === 'build' ? t('service.logs.download') : t('service.logs.options')} className="logs-tool-btn" onClick={(e) => optionsPop.toggle(e.currentTarget)}>
            <div className="tool-icon">
              <Download size={14} />
            </div>
          </button>
          <Popover anchor={optionsPop.anchor} onClose={optionsPop.close} align="end" width={220}>
            <div className="menu-label">{t('service.logs.options')}</div>
            <button type="button" className="menu-item" onClick={() => setWrap((v) => !v)}>
              {t('service.logs.wrap')}
              <span className="switch menu-right" role="switch" aria-checked={wrap} />
            </button>
            <button type="button" className="menu-item" onClick={() => setShowAttrs((v) => !v)}>
              {t('service.logs.attrs')}
              <span className="switch menu-right" role="switch" aria-checked={showAttrs} />
            </button>
          </Popover>
          {kind !== 'build' && explorerHref && (
            <div>
              <Link to={explorerHref} title={t('service.logs.explorer')} className="logs-tool-btn">
                <div className="tool-icon">
                  <ExternalLink size={14} />
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="logs-table-wrap">
        <div role="table" className="logs-table">
          <div role="rowgroup" className="logs-head">
            <div role="row" className="logs-row head">
              <div role="columnheader" className="logs-th time">
                {t('service.logs.timeCol')}
                <div className="logs-resize">
                  <div />
                </div>
              </div>
              <div role="columnheader" className="logs-th data">
                {dataLabel}
              </div>
              <div role="columnheader" className="logs-th settings">
                <button type="button" title={t('service.logs.layout')} className="logs-layout-btn" onClick={(e) => layoutPop.toggle(e.currentTarget)}>
                  <div className="tool-icon">
                    <Settings size={14} />
                  </div>
                </button>
              </div>
            </div>
          </div>
          <Popover anchor={layoutPop.anchor} onClose={layoutPop.close} align="end" width={200}>
            <div className="menu-label">{t('service.logs.columns')}</div>
            <button type="button" className="menu-item" data-active="true">
              {t('service.logs.time')}
            </button>
            <button type="button" className="menu-item" data-active="true">
              {dataLabel}
            </button>
          </Popover>
          <div className="logs-scroll" ref={scrollRef}>
            <div role="rowgroup" className={`logs-body kind-${kind}${wrap ? '' : ' nowrap'}`}>
              {range && !q && <RangeMarker label={t('service.logs.rangeStart')} time={range.start} />}
              {filtered.length === 0 && <div className="logs-empty">{q ? t('service.logs.noMatch', { q }) : (emptyLabel ?? t('service.logs.empty'))}</div>}
              {filtered.map((l, i) => (
                <div role="row" key={i} className={`logs-row level-${l.level}${kind === 'build' && l.step ? ' step' : ''}`}>
                  <div role="cell" className="logs-td time">
                    <div className="logs-time">
                      <LevelBar level={l.level} />
                      <span>
                        <time title={fmtKstFull(l.ts)}>{fmtKst(l.ts)}</time>
                      </span>
                    </div>
                  </div>
                  <div role="cell" className="logs-td data">
                    <div className="logs-data">
                      {kind === 'build' ? (
                        <BuildRow line={l} />
                      ) : (
                        <div className="log-msg-inner">
                          <span className="log-message">{l.message || '\u00a0'}</span>
                          {showAttrs &&
                            l.attrs?.map((a, j) => (
                              <span key={j} className="log-attr">
                                <span className="log-attr-key">{a.key}:</span>
                                <span className="log-attr-val">{a.value}</span>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {range && !q && <RangeMarker label={t('service.logs.rangeEnd')} time={range.end} />}
            </div>
          </div>
          <div className="logs-jump">
            <button type="button" className="logs-jump-btn" aria-label={t('service.logs.top')} onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="logs-jump-btn" aria-label={t('service.logs.bottom')} onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}>
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

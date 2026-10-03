import { ArrowDown, ArrowRight, ArrowUp, Check, Download, ExternalLink, RefreshCw, Search, Settings, ChevronRight, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Popover, usePopover } from '../../components/ui';
import { fmtKst, fmtKstFull, type LogLine } from '../../data/mock';
import { useI18n } from '../../i18n';

export function LevelBar({ level }: { level: LogLine['level'] }) {
  return (
    <button type="button" className="log-level-btn" tabIndex={-1}>
      <div className={`log-level ${level}`} />
    </button>
  );
}

/** 로그 검색창. "/" 를 누르면 입력창으로 간다. */
export function LogSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="logs-filter">
      <div className="logs-filter-icon">
        <Search size={16} />
      </div>
      <div className="logs-filter-field">
        {!value && <span className="logs-filter-ph">{label}</span>}
        <textarea ref={inputRef} aria-label={label} rows={1} value={value} spellCheck={false} onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))} />
      </div>
      {!value && (
        <div className="logs-filter-kbd" title={t('service.logs.focus')} onClick={() => inputRef.current?.focus()}>
          <span>/</span>
        </div>
      )}
    </div>
  );
}

/** 맨 위·맨 아래로 가는 버튼. */
export function LogJump({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n();
  return (
    <div className="logs-jump">
      <button type="button" className="logs-jump-btn" aria-label={t('service.logs.top')} onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
        <ArrowUp size={16} />
      </button>
      <button type="button" className="logs-jump-btn" aria-label={t('service.logs.bottom')} onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}>
        <ArrowDown size={16} />
      </button>
    </div>
  );
}

/** 맨 아래를 보고 있을 때만 새 줄을 따라간다. 위로 올려 읽는 중이면 그대로 둔다. */
export function useFollowTail(scrollRef: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const follow = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
}

/** 표 위아래에 놓는 한 줄 안내(범위가 잘렸다, 원본 배포의 로그다 등). */
export function LogNotice({ children }: { children: ReactNode }) {
  return <div className="logs-notice">{children}</div>;
}

/** 로그를 못 불러왔을 때의 안내. */
export function LogError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="logs-empty logs-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          {t('service.dp.logs.retry')}
        </button>
      )}
    </div>
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
    // 단계로 나뉘지 않은 줄(실제 빌드 로그)은 `[Container]` 같은 앞머리까지 그대로 보여 준다.
    return (
      <div className="bl-plain">
        <span>{line.message || '\u00a0'}</span>
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
  loading,
  error,
  onRetry,
  onDownload,
  onRefresh,
  header,
  footer,
}: {
  lines: LogLine[];
  range?: { start: string; end: string };
  kind: 'build' | 'deploy' | 'http';
  explorerHref?: string;
  emptyLabel?: string;
  /** 첫 응답을 기다리는 중. */
  loading?: boolean;
  /** 못 불러왔을 때의 문장. 받아 둔 줄이 있으면 그 아래에 붙는다. */
  error?: string | null;
  onRetry?: () => void;
  /** 있으면 다운로드 버튼이 이 함수를 부른다(Build). 없으면 옵션 메뉴를 연다. */
  onDownload?: () => void;
  /** 있으면 새로고침 버튼을 둔다. */
  onRefresh?: () => void;
  /** 툴바 아래에 놓는 안내. */
  header?: ReactNode;
  /** 줄 아래에 놓는 안내(새 로그를 기다리는 중 등). */
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [wrap, setWrap] = useState(true);
  const [showAttrs, setShowAttrs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Logs follow the tail, like the original viewer (but not while the reader has scrolled up)
  const onScroll = useFollowTail(scrollRef, [filtered.length]);

  const dataLabel = kind === 'build' ? t('service.logs.message') : t('service.logs.data');
  const searchLabel = kind === 'build' ? t('service.logs.searchBuild') : t('service.logs.filter');

  return (
    <div className="logs">
      <div className="logs-toolbar-wrap">
        <div className={`logs-toolbar${kind === 'build' ? ' single' : ''}`}>
          <LogSearch value={q} onChange={setQ} label={searchLabel} />
          <button
            type="button"
            title={onDownload ? t('service.logs.download') : t('service.logs.options')}
            className="logs-tool-btn"
            disabled={onDownload ? lines.length === 0 : undefined}
            onClick={onDownload ? onDownload : (e) => optionsPop.toggle(e.currentTarget)}
          >
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
          {onRefresh && (
            <button type="button" title={t('service.logs.refresh')} aria-label={t('service.logs.refresh')} className="logs-tool-btn" onClick={onRefresh}>
              <div className="tool-icon">
                <RefreshCw size={14} />
              </div>
            </button>
          )}
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
        {header}
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
          <div className="logs-scroll" ref={scrollRef} onScroll={onScroll}>
            <div role="rowgroup" className={`logs-body kind-${kind}${wrap ? '' : ' nowrap'}`}>
              {range && !q && <RangeMarker label={t('service.logs.rangeStart')} time={range.start} />}
              {filtered.length === 0 && !error && (
                <div className="logs-empty">
                  {q && lines.length > 0 ? t('service.logs.noMatch', { q }) : loading ? t('service.loading') : (emptyLabel ?? t('service.logs.empty'))}
                </div>
              )}
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
              {error && <LogError message={error} onRetry={onRetry} />}
              {footer}
            </div>
          </div>
          <LogJump scrollRef={scrollRef} />
        </div>
      </div>
    </div>
  );
}

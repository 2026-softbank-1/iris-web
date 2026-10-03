import { RefreshCw } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { formatBytes, formatResponseTime, nsToIso, statusLevel } from '../../data/deploymentLogModel';
import { fmtKst, fmtKstFull } from '../../data/mock';
import { useI18n } from '../../i18n';
import { STATUS_CLASSES, type NetworkLogEntryDto, type StatusClass } from '../../lib/endpoints';
import { LevelBar, LogError, LogJump, LogSearch, useFollowTail } from './LogTable';

/**
 * 배포의 네트워크 로그(ALB 접근 로그). URL·메서드·IP 는 수집하지 않아서 시각·상태 코드·바이트·응답 시간만 열로 보여 준다.
 * 상태 코드 종류(2xx~5xx)는 서버가 거르고, 검색창은 받아 온 줄에서 상태 코드로 거른다.
 */
export function NetworkLogTable({
  entries,
  statusClass,
  onStatusClass,
  loading,
  error,
  onRetry,
  onRefresh,
  emptyLabel,
  header,
}: {
  entries: NetworkLogEntryDto[];
  statusClass?: StatusClass;
  onStatusClass: (next?: StatusClass) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh: () => void;
  emptyLabel: string;
  header?: ReactNode;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return entries;
    return entries.filter((e) => `${e.status} ${e.targetStatus ?? ''}`.includes(query));
  }, [q, entries]);
  const onScroll = useFollowTail(scrollRef, [filtered.length]);

  const filterLabel = t('service.dp.net.filter');
  const classes: { value?: StatusClass; label: string }[] = [{ label: t('service.dp.net.all') }, ...STATUS_CLASSES.map((value) => ({ value, label: value }))];

  return (
    <div className="logs">
      <div className="logs-toolbar-wrap">
        <div className="logs-toolbar net">
          <LogSearch value={q} onChange={setQ} label={filterLabel} />
          <div role="tablist" aria-label={t('service.dp.net.statusClass')} className="seg logs-class">
            {classes.map((c) => (
              <button key={c.label} type="button" role="tab" aria-selected={statusClass === c.value} data-state={statusClass === c.value ? 'active' : 'inactive'} onClick={() => onStatusClass(c.value)}>
                <p>{c.label}</p>
              </button>
            ))}
          </div>
          <button type="button" title={t('service.logs.refresh')} aria-label={t('service.logs.refresh')} className="logs-tool-btn" onClick={onRefresh}>
            <div className="tool-icon">
              <RefreshCw size={14} />
            </div>
          </button>
        </div>
        {header}
      </div>
      <div className="logs-table-wrap">
        <div role="table" className="logs-table">
          <div role="rowgroup" className="logs-head">
            <div role="row" className="logs-row head net">
              <div role="columnheader" className="logs-th time">
                {t('service.logs.timeCol')}
              </div>
              <div role="columnheader" className="logs-th" title={t('service.dp.net.statusHint')}>
                {t('service.dp.net.status')}
              </div>
              <div role="columnheader" className="logs-th" title={t('service.dp.net.statusHint')}>
                {t('service.dp.net.target')}
              </div>
              <div role="columnheader" className="logs-th num" title={t('service.dp.net.bytesHint')}>
                {t('service.dp.net.received')}
              </div>
              <div role="columnheader" className="logs-th num" title={t('service.dp.net.bytesHint')}>
                {t('service.dp.net.sent')}
              </div>
              <div role="columnheader" className="logs-th num" title={t('service.dp.net.timeHint')}>
                {t('service.dp.net.time')}
              </div>
              <div role="columnheader" className="logs-th" />
            </div>
          </div>
          <div className="logs-scroll" ref={scrollRef} onScroll={onScroll}>
            <div role="rowgroup" className="logs-body kind-http">
              {filtered.length === 0 && !error && (
                <div className="logs-empty">{q && entries.length > 0 ? t('service.logs.noMatch', { q }) : loading ? t('service.loading') : emptyLabel}</div>
              )}
              {filtered.map((e, i) => {
                const level = statusLevel(e.status);
                const ts = nsToIso(e.timestampNs);
                return (
                  // 같은 시각의 요청이 여럿일 수 있어서 순번을 키에 쓴다(목록은 통째로 다시 받는다).
                  <div role="row" key={`${e.timestampNs}-${i}`} className={`logs-row net level-${level}`}>
                    <div role="cell" className="logs-td time">
                      <div className="logs-time">
                        <LevelBar level={level} />
                        <span>
                          <time title={fmtKstFull(ts)}>{fmtKst(ts)}</time>
                        </span>
                      </div>
                    </div>
                    <div role="cell" className={`logs-td net-code ${level}`}>
                      {e.status}
                    </div>
                    <div role="cell" className="logs-td net-code muted">
                      {e.targetStatus ?? '—'}
                    </div>
                    <div role="cell" className="logs-td num">
                      {formatBytes(e.receivedBytes)}
                    </div>
                    <div role="cell" className="logs-td num">
                      {formatBytes(e.sentBytes)}
                    </div>
                    <div role="cell" className="logs-td num">
                      {formatResponseTime(e.responseTimeSeconds)}
                    </div>
                    <div role="cell" className="logs-td" />
                  </div>
                );
              })}
              {error && <LogError message={error} onRetry={onRetry} />}
            </div>
          </div>
          <LogJump scrollRef={scrollRef} />
        </div>
      </div>
    </div>
  );
}

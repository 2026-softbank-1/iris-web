import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useProjects } from '../data/ProjectsContext';
import { targetLabel } from '../data/targetModel';
import { useI18n, type MessageKey } from '../i18n';
import { isTargetSupported, type OnpremServerStatus, type TargetDto } from '../lib/endpoints';
import { Popover, usePopover } from './ui';

const SHORT_STATUS: Record<OnpremServerStatus, MessageKey> = {
  PENDING: 'servers.short.PENDING',
  REGISTERING: 'servers.short.REGISTERING',
  CONNECTED: 'servers.short.CONNECTED',
  FAILED: 'servers.short.FAILED',
};

/** 내 서버 타깃은 연결 상태(점 + 짧은 말)를 붙인다. 공용 온프레미스 타깃은 상태가 없다. */
function StatusDot({ status }: { status?: OnpremServerStatus }) {
  const { t } = useI18n();
  if (!status) return null;
  return <span className={`tp-status ${status.toLowerCase()}`}>{t(SHORT_STATUS[status])}</span>;
}

/**
 * 온프레미스 선택지 순서: 공용 onprem 타깃이 먼저, 그다음 내 서버(연결된 것 먼저). 정렬은 안정적이라 같은 무리 안에서는
 * 서버 목록 순서(최신순)를 지킨다.
 */
const rank = (target: TargetDto) => (target.onpremServerId == null ? 0 : target.connectionStatus === 'CONNECTED' ? 1 : 2);

/**
 * 배포 대상 선택. 종류(AWS·온프레미스)만 라디오로 고르고, 온프레미스는 옆 드롭다운에서 공용 서버나 내 서버를 고른다.
 * 저장되는 값은 고른 타깃 id 하나다. 드롭다운을 바꾸면 온프레미스 라디오도 같이 골라진다.
 */
export function TargetPicker({
  value,
  onChange,
  name,
  disabled = false,
  onAddServer,
  unsupportedClassName,
  noteClassName,
  unsupportedLabel,
}: {
  value?: number;
  onChange: (targetId: number) => void;
  /** 라디오 묶음 이름. 화면에서 유일해야 한다. */
  name: string;
  /** 타깃을 바꿀 수 없을 때(첫 배포 뒤). 지금 값은 그대로 보인다. */
  disabled?: boolean;
  onAddServer?: () => void;
  unsupportedClassName: string;
  noteClassName: string;
  unsupportedLabel: string;
}) {
  const { t } = useI18n();
  const { targets, servers } = useProjects();
  const pop = usePopover();
  const listRef = useRef<HTMLDivElement>(null);

  const onprems = targets.filter((target) => target.kind === 'ONPREM').sort((a, b) => rank(a) - rank(b));
  const others = targets.filter((target) => target.kind !== 'ONPREM');
  const fallback = onprems.find((target) => target.connectionStatus === 'CONNECTED') ?? onprems.find((target) => target.onpremServerId == null) ?? onprems[0];
  // 온프레미스 라디오를 고르면 쓸 서버. 지금 값이 온프레미스면 그것이고, 아니면 마지막으로 고른 것 또는 기본값이다.
  const [choice, setChoice] = useState<number | undefined>();
  const valueIsOnprem = onprems.some((target) => target.id === value);
  useEffect(() => {
    if (valueIsOnprem) setChoice(value);
  }, [value, valueIsOnprem]);
  const current = onprems.find((target) => target.id === (valueIsOnprem ? value : choice)) ?? fallback;

  const label = (target: TargetDto) => (target.onpremServerId == null ? t('servers.picker.shared') : targetLabel(target, servers));

  const pick = (target: TargetDto) => {
    pop.close();
    setChoice(target.id);
    if (target.id !== value) onChange(target.id);
  };

  // 목록이 열리면 고른 항목(없으면 첫 항목)에 포커스를 둔다. 위아래 화살표로 옮긴다.
  useEffect(() => {
    if (!pop.isOpen) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      (list?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pop.isOpen]);
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"], .tp-add') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      {others.map((target) => {
        const supported = isTargetSupported(target);
        return (
          <label key={target.id} className={supported ? undefined : unsupportedClassName} title={supported ? undefined : unsupportedLabel}>
            <input type="radio" name={name} disabled={!supported || disabled} checked={supported && value === target.id} onChange={() => onChange(target.id)} />
            {target.name}
            {!supported && <span className={noteClassName}>{unsupportedLabel}</span>}
          </label>
        );
      })}
      {(onprems.length > 0 || onAddServer) && (
        <span className="tp-onprem">
          <label>
            <input
              type="radio"
              name={name}
              disabled={disabled || !current}
              checked={valueIsOnprem}
              onChange={() => current && onChange(current.id)}
            />
            {t('servers.picker.onprem')}
          </label>
          <button
            type="button"
            className="tp-trigger"
            aria-haspopup="listbox"
            aria-expanded={pop.isOpen}
            aria-label={t('servers.picker.choose')}
            disabled={disabled}
            onClick={(e) => pop.toggle(e.currentTarget)}
          >
            <span className="tp-trigger-name">{current ? label(current) : t('servers.picker.none')}</span>
            {current && <StatusDot status={current.connectionStatus} />}
            <ChevronDown size={14} />
          </button>
          <Popover anchor={pop.anchor} onClose={pop.close} align="start" className="menu tp-menu">
            <div ref={listRef} onKeyDown={onListKey}>
            <div role="listbox" aria-label={t('servers.picker.choose')}>
              {onprems.map((target) => {
                const selected = target.id === current?.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="menu-item tp-option"
                    onClick={() => pick(target)}
                  >
                    <span className="tp-check">{selected && <Check size={14} />}</span>
                    <span className="tp-option-name">{label(target)}</span>
                    <StatusDot status={target.connectionStatus} />
                  </button>
                );
              })}
            </div>
            {onAddServer && (
              <>
                {onprems.length > 0 && <div className="menu-sep" />}
                <button type="button" className="menu-item tp-add" onClick={() => { pop.close(); onAddServer(); }}>
                  <Plus size={14} className="menu-icon" />
                  {t('servers.addInline')}
                </button>
              </>
            )}
            </div>
          </Popover>
        </span>
      )}
    </>
  );
}

import { Ellipsis, EllipsisVertical, RefreshCw, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceBadge } from '../../components/brand';
import { Avatar, Popover, usePopover } from '../../components/ui';
import { deploymentLabel } from '../../data/deploymentModel';
import { strategyLabel } from '../../data/deploymentStrategyModel';
import { fmtKstFull, type Deployment } from '../../data/mock';
import { formatAgo, useI18n } from '../../i18n';

export function AuthorAvatar({ d }: { d: Deployment }) {
  return (
    <div className="dep-avatar">
      <Avatar src={d.authorAvatar} size={32} title={d.author} />
      <div className="dep-avatar-badge">
        <SourceBadge size={14} />
      </div>
    </div>
  );
}

export function DeploymentActions({
  size = 20,
  className = 'dep-menu-btn',
  horizontal = false,
  onDiagnose,
  onRedeploy,
  onRestart,
  onRollback,
  deployBlockedReason,
}: {
  size?: number;
  className?: string;
  horizontal?: boolean;
  /** 실패한 배포의 AI 진단 화면을 연다. 진단할 수 있는 배포(canDiagnose)에서만 준다. */
  onDiagnose?: () => void;
  onRedeploy?: () => void;
  /** 지금 떠 있는 배포를 빌드 없이 다시 시작한다. Active 배포에서만 준다. */
  onRestart?: () => void;
  /** 이전에 성공한 배포로 되돌린다. 성공했던 배포(이미 대체된 것)에서만 준다. */
  onRollback?: () => void;
  /** 있으면 새 배포를 만드는 동작(재배포·재시작·롤백)을 막고 이 이유를 보여 준다. 서비스의 서버가 연결되지 않았을 때다. */
  deployBlockedReason?: string;
}) {
  const pop = usePopover();
  const { t } = useI18n();
  // 고를 수 있는 동작이 없으면 빈 메뉴가 열리지 않게 ⋮ 버튼도 숨긴다.
  if (!onDiagnose && !onRedeploy && !onRestart && !onRollback) return null;
  return (
    <>
      <button
        type="button"
        title={t('service.row.actions')}
        className={className}
        data-state={pop.isOpen ? 'open' : 'closed'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pop.toggle(e.currentTarget);
        }}
      >
        <div className="tool-icon">
          {horizontal ? <Ellipsis size={size} /> : <EllipsisVertical size={size} />}
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={deployBlockedReason ? 260 : 200}>
        {deployBlockedReason && (onRedeploy || onRestart || onRollback) && <div className="menu-label menu-note">{deployBlockedReason}</div>}
        {onDiagnose && (
          <button
            type="button"
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onDiagnose();
            }}
          >
            <Sparkles size={16} className="menu-icon" /> {t('diag.action')}
          </button>
        )}
        {onRedeploy && (
          <button
            type="button"
            className="menu-item"
            disabled={!!deployBlockedReason}
            title={deployBlockedReason}
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRedeploy();
            }}
          >
            <RotateCcw size={16} className="menu-icon" /> {t('service.row.redeploy')}
          </button>
        )}
        {onRestart && (
          <button
            type="button"
            className="menu-item"
            disabled={!!deployBlockedReason}
            title={deployBlockedReason}
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRestart();
            }}
          >
            <RefreshCw size={16} className="menu-icon" /> {t('service.row.restart')}
          </button>
        )}
        {onRollback && (
          <button
            type="button"
            className="menu-item"
            disabled={!!deployBlockedReason}
            title={deployBlockedReason}
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRollback();
            }}
          >
            <Undo2 size={16} className="menu-icon" /> {t('service.row.rollback')}
          </button>
        )}
      </Popover>
    </>
  );
}

export function DeploymentRow({ d, to, variant, onDiagnose, onRedeploy, onRestart, onRollback, deployBlockedReason }: { d: Deployment; to: string; variant: 'active' | 'history'; onDiagnose?: () => void; onRedeploy?: () => void; onRestart?: () => void; onRollback?: () => void; deployBlockedReason?: string }) {
  const { t, lang } = useI18n();
  const status = d.status.toLowerCase();
  return (
    <Link to={to} className={`dep-row-link ${variant}`}>
      <div className={`dep-row ${variant}`}>
        <div className="dep-grid">
          <div className="dep-status">
            <div className={`status-pill ${status}`}>{deploymentLabel(d.status)}</div>
          </div>
          <AuthorAvatar d={d} />
          <div className="dep-text">
            <div className="dep-text-col">
              <p className="dep-msg truncate">{d.message}</p>
              <p className="dep-meta">
                <time title={fmtKstFull(d.createdAt)}>{formatAgo(d.createdAt, lang)}</time>
                {'  '}{t('service.row.via')}{'  '}
                <span>{d.via ?? 'GitHub'}</span>
                {/* 롤링은 기본이라 적지 않는다. 롤링으로 대체된 배포는 상세에서 알린다. */}
                {d.deploymentStrategy && d.deploymentStrategy !== 'ROLLING' && <span>{' · '}{strategyLabel(t, d.deploymentStrategy)}</span>}
              </p>
            </div>
          </div>
          <div className="dep-actions">
            <DeploymentActions onDiagnose={onDiagnose} onRedeploy={onRedeploy} onRestart={onRestart} onRollback={onRollback} deployBlockedReason={deployBlockedReason} />
          </div>
        </div>
      </div>
    </Link>
  );
}

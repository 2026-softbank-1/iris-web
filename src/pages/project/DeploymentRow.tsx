import { Ellipsis, EllipsisVertical, Copy, RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceBadge } from '../../components/brand';
import { Avatar, Popover, usePopover, useUI } from '../../components/ui';
import { deploymentLabel } from '../../data/deploymentModel';
import { fmtKstFull, timeAgo, type Deployment } from '../../data/mock';

export function AuthorAvatar({ d }: { d: Deployment }) {
  return (
    <div className="dep-avatar">
      <Avatar src={d.authorAvatar} size={24} title={d.author} />
      <div className="dep-avatar-badge">
        <SourceBadge size={22} />
      </div>
    </div>
  );
}

export function DeploymentActions({
  size = 20,
  className = 'dep-menu-btn',
  horizontal = false,
  deployment,
  onRedeploy,
  onRestart,
  onRollback,
}: {
  size?: number;
  className?: string;
  horizontal?: boolean;
  deployment: Deployment;
  onRedeploy?: () => void;
  /** 지금 떠 있는 배포를 빌드 없이 다시 시작한다. Active 배포에서만 준다. */
  onRestart?: () => void;
  /** 이전에 성공한 배포로 되돌린다. 성공했던 배포(이미 대체된 것)에서만 준다. */
  onRollback?: () => void;
}) {
  const pop = usePopover();
  const { toast } = useUI();
  return (
    <>
      <button
        type="button"
        title="Deployment actions"
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
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={200}>
        {onRedeploy && (
          <button
            type="button"
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRedeploy();
            }}
          >
            <RotateCcw size={16} className="menu-icon" /> Redeploy
          </button>
        )}
        {onRestart && (
          <button
            type="button"
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRestart();
            }}
          >
            <RefreshCw size={16} className="menu-icon" /> Restart
          </button>
        )}
        {onRollback && (
          <button
            type="button"
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              pop.close();
              onRollback();
            }}
          >
            <Undo2 size={16} className="menu-icon" /> Roll back to this
          </button>
        )}
        <button
          type="button"
          className="menu-item"
          onClick={(e) => {
            e.stopPropagation();
            pop.close();
            navigator.clipboard?.writeText(deployment.id);
            toast('Deployment ID copied');
          }}
        >
          <Copy size={16} className="menu-icon" /> Copy ID
        </button>
      </Popover>
    </>
  );
}

export function DeploymentRow({ d, to, variant, onRedeploy, onRestart, onRollback }: { d: Deployment; to: string; variant: 'active' | 'history'; onRedeploy?: () => void; onRestart?: () => void; onRollback?: () => void }) {
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
                <time title={fmtKstFull(d.createdAt)}>{timeAgo(d.createdAt)}</time>
                {'  '}via{'  '}
                <span>{d.via ?? 'GitHub'}</span>
              </p>
            </div>
          </div>
          <div className="dep-actions">
            <DeploymentActions deployment={d} onRedeploy={onRedeploy} onRestart={onRestart} onRollback={onRollback} />
            <div className={`dep-viewlogs-wrap${variant === 'history' ? ' hover-only' : ''}`}>
              <span className={`dep-viewlogs ${variant}`}>
                <span>View details</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

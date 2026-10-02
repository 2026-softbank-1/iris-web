import { Ellipsis, EllipsisVertical, Copy } from 'lucide-react';
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
}: {
  size?: number;
  className?: string;
  horizontal?: boolean;
  deployment: Deployment;
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

export function DeploymentRow({ d, to, variant }: { d: Deployment; to: string; variant: 'active' | 'history' }) {
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
            <DeploymentActions deployment={d} />
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

import { Ellipsis, EllipsisVertical, RotateCcw, ScrollText, Trash2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceBadge } from '../../components/brand';
import { Avatar, Popover, usePopover, useUI } from '../../components/ui';
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

export function DeploymentActions({ size = 20, className = 'dep-menu-btn', horizontal = false }: { size?: number; className?: string; horizontal?: boolean }) {
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
            toast('Redeploy requires an active plan');
          }}
        >
          <RotateCcw size={16} className="menu-icon" /> Redeploy
        </button>
        <button
          type="button"
          className="menu-item"
          onClick={(e) => {
            e.stopPropagation();
            pop.close();
            toast('Deployment ID copied');
          }}
        >
          <Copy size={16} className="menu-icon" /> Copy ID
        </button>
        <button type="button" className="menu-item" onClick={(e) => (e.stopPropagation(), pop.close())}>
          <ScrollText size={16} className="menu-icon" /> View logs
        </button>
        <div className="menu-sep" />
        <button
          type="button"
          className="menu-item danger"
          onClick={(e) => {
            e.stopPropagation();
            pop.close();
            toast('Removed deployments cannot be deleted');
          }}
        >
          <Trash2 size={16} /> Remove
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
            <div className={`status-pill ${status}`}>{d.status[0] + d.status.slice(1).toLowerCase()}</div>
          </div>
          <AuthorAvatar d={d} />
          <div className="dep-text">
            <div className="dep-text-col">
              <p className="dep-msg truncate">{d.message}</p>
              <p className="dep-meta">
                <time title={fmtKstFull(d.createdAt)}>{timeAgo(d.createdAt)}</time>
                {'  '}via{'  '}
                <span>GitHub</span>
              </p>
            </div>
          </div>
          <div className="dep-actions">
            <DeploymentActions />
            <div className={`dep-viewlogs-wrap${variant === 'history' ? ' hover-only' : ''}`}>
              <span className={`dep-viewlogs ${variant}`}>
                <span>View logs</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

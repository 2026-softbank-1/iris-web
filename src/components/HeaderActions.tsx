import { Bell, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workspace } from '../data/mock';
import { Popover, Tooltip, usePopover } from './ui';

export function NotificationsButton() {
  const pop = usePopover();
  return (
    <>
      <Tooltip label="Notifications" side="bottom">
        <button
          type="button"
          aria-label="Notifications"
          className="icon-btn"
          data-state={pop.isOpen ? 'open' : 'closed'}
          onClick={(e) => pop.toggle(e.currentTarget)}
        >
          <Bell size={16} strokeWidth={2} />
        </button>
      </Tooltip>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={360} className="menu notif-pop">
        <div className="notif-head">
          <span>Notifications</span>
          <button type="button" className="notif-link">
            Mark all as read
          </button>
        </div>
        <div className="notif-empty">
          <Inbox size={20} />
          <p>You're all caught up</p>
          <span>New deploy and usage alerts will show up here.</span>
        </div>
      </Popover>
    </>
  );
}

export function TrialBadge() {
  const pop = usePopover();
  const navigate = useNavigate();
  return (
    <>
      <button type="button" className="trial-badge" data-state={pop.isOpen ? 'open' : 'closed'} onClick={(e) => pop.toggle(e.currentTarget)}>
        <div>
          <p>
            <span>
              {workspace.trialDaysLeft} days or {workspace.creditsLeft} left
            </span>
          </p>
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={300} className="menu trial-pop">
        <p className="trial-pop-title">Trial plan</p>
        <p className="trial-pop-body">
          You have <b>{workspace.trialDaysLeft} days</b> or <b>{workspace.creditsLeft}</b> in credits left. Pick a plan to keep your
          services running once the trial ends.
        </p>
        <div className="trial-pop-meter">
          <div style={{ width: `${(4.99 / 5) * 100}%` }} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => {
            pop.close();
            navigate('/workspace/plans');
          }}
        >
          Choose a Plan
        </button>
      </Popover>
    </>
  );
}

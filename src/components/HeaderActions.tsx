import { Bell, Inbox } from 'lucide-react';
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

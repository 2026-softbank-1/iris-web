import { Bell, Inbox } from 'lucide-react';
import { useI18n } from '../i18n';
import { Popover, Tooltip, usePopover } from './ui';

export function NotificationsButton() {
  const pop = usePopover();
  const { t } = useI18n();
  return (
    <>
      <Tooltip label={t('notif.title')} side="bottom">
        <button
          type="button"
          aria-label={t('notif.title')}
          className="icon-btn"
          data-state={pop.isOpen ? 'open' : 'closed'}
          onClick={(e) => pop.toggle(e.currentTarget)}
        >
          <Bell size={16} strokeWidth={2} />
        </button>
      </Tooltip>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={360} className="menu notif-pop">
        <div className="notif-head">
          <span>{t('notif.title')}</span>
          <button type="button" className="notif-link">
            {t('notif.markRead')}
          </button>
        </div>
        <div className="notif-empty">
          <Inbox size={20} />
          <p>{t('notif.emptyTitle')}</p>
          <span>{t('notif.emptyBody')}</span>
        </div>
      </Popover>
    </>
  );
}

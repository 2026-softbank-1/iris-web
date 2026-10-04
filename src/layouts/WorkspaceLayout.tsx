import {
  // ChartNoAxesColumn, // Usage nav item (disabled for now)
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  LayoutGrid,
  LogOut,
  Moon,
  Server,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/brand';
import { NotificationsButton } from '../components/HeaderActions';
import { Avatar, Popover, usePopover } from '../components/ui';
import { useAuth, useSessionUser } from '../auth/AuthContext';
import { getTheme, toggleTheme } from '../lib/theme';
import { LanguageButton } from '../components/LanguageButton';
import { useI18n, type MessageKey } from '../i18n';

// 아직 서버 기능이 없어서 세 화면 모두 '준비 중'을 보여준다(WorkspaceSettings).
const SETTINGS_LINKS: { to: string; label: MessageKey }[] = [
  { to: '/workspace/domains', label: 'nav.domains' },
  { to: '/workspace/audit-logs', label: 'nav.auditLogs' },
  { to: '/workspace/developer', label: 'nav.developer' },
];

function SideItem({ to, icon, label, end }: { to: string; icon: ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="side-link">
      {({ isActive }) => (
        <div className={`side-item${isActive ? ' active' : ''}`}>
          <div className="side-icon">{icon}</div>
          <span>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function AccountButton() {
  const pop = usePopover();
  const auth = useAuth();
  const user = useSessionUser();
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <>
      <button type="button" className="account-btn" data-state={pop.isOpen ? 'open' : 'closed'} onClick={(e) => pop.toggle(e.currentTarget)}>
        <div className="account-inner">
          <Avatar src={user.avatarUrl} size={24} title={user.login} />
          <p className="truncate">{user.login}</p>
          <div className="account-chevron">
            <EllipsisVertical size={16} />
          </div>
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} side="top" width={204}>
        <div className="menu-label">@{user.login}</div>
        <button type="button" className="menu-item" onClick={pop.close}>
          <User size={16} className="menu-icon" />
          {t('menu.account')}
        </button>
        <button type="button" className="menu-item" onClick={() => { pop.close(); toggleTheme(); }}>
          {getTheme() === 'dark' ? <Moon size={16} className="menu-icon" /> : <Sun size={16} className="menu-icon" />}
          {t('menu.theme')}
          <span className="menu-right">{t(getTheme() === 'dark' ? 'menu.themeDark' : 'menu.themeLight')}</span>
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={async () => { pop.close(); await auth.logout(); navigate('/login'); }}>
          <LogOut size={16} className="menu-icon" />
          {t('menu.logout')}
        </button>
      </Popover>
    </>
  );
}

export function WorkspaceLayout() {
  const location = useLocation();
  const { t } = useI18n();
  const inSettings = SETTINGS_LINKS.some((l) => location.pathname.startsWith(l.to));
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  useEffect(() => {
    if (inSettings) setSettingsOpen(true);
  }, [inSettings]);

  return (
    <div className="ws-shell">
      <aside className="ws-aside">
        <div className="ws-aside-top">
          <div className="ws-brand">
            <NavLink to="/dashboard" className="ws-logo">
              <div>
                <LogoMark size={24} />
              </div>
            </NavLink>
          </div>
          <div className="side-divider" />
          <div className="side-section">
            <nav className="side-nav">
              <SideItem to="/dashboard" icon={<LayoutGrid size={16} />} label={t('nav.projects')} />
              <SideItem to="/workspace/servers" icon={<Server size={16} />} label={t('nav.servers')} />
              <div className="side-divider inset" />
              <button type="button" className={`side-item side-btn${settingsOpen ? ' open' : ''}`} onClick={() => setSettingsOpen((v) => !v)}>
                <div className="side-icon">
                  <Settings size={16} />
                </div>
                <span className="side-btn-label">
                  {t('nav.settings')}
                  <div className="side-icon">{settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </span>
              </button>
              {settingsOpen && (
                <div className="side-sub">
                  <div className="side-sub-line" />
                  {SETTINGS_LINKS.map((l) => (
                    <NavLink key={l.to} to={l.to} className="side-link">
                      {({ isActive }) => (
                        <div className={`side-item sub${isActive ? ' active' : ''}`}>
                          <span className="side-sub-spacer" />
                          <span>{t(l.label)}</span>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
              {/* Usage is disabled for now (non-MVP) */}
              {/* <SideItem to="/workspace/usage" icon={<ChartNoAxesColumn size={16} />} label="Usage" /> */}
            </nav>
          </div>
          <div className="side-fill" />
        </div>
        <div className="ws-aside-bottom">
          <AccountButton />
        </div>
        <button type="button" aria-label={t('nav.collapse')} className="side-collapse">
          <div />
        </button>
      </aside>
      <div className="ws-right">
        <header className="ws-header">
          <div className="ws-header-left" />
          <div className="ws-header-actions">
            <LanguageButton />
            <NotificationsButton />
          </div>
        </header>
        <main className="ws-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import {
  // ChartNoAxesColumn, // Usage nav item (disabled for now)
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  LayoutGrid,
  LogOut,
  Moon,
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

const SETTINGS_LINKS = [
  { to: '/workspace/domains', label: 'Domains' },
  { to: '/workspace/audit-logs', label: 'Audit Logs' },
  { to: '/workspace/developer', label: 'Developer' },
  { to: '/workspace/ssh-keys', label: 'SSH Keys' },
  { to: '/workspace/earnings', label: 'Earnings' },
  { to: '/workspace/referrals', label: 'Referrals' },
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
          Account Settings
        </button>
        <button type="button" className="menu-item" onClick={() => { pop.close(); toggleTheme(); }}>
          {getTheme() === 'dark' ? <Moon size={16} className="menu-icon" /> : <Sun size={16} className="menu-icon" />}
          Theme
          <span className="menu-right">{getTheme() === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={async () => { pop.close(); await auth.logout(); navigate('/login'); }}>
          <LogOut size={16} className="menu-icon" />
          Logout
        </button>
      </Popover>
    </>
  );
}

export function WorkspaceLayout() {
  const location = useLocation();
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
              <SideItem to="/dashboard" icon={<LayoutGrid size={16} />} label="Projects" />
              <div className="side-divider inset" />
              {/* Usage is disabled for now (non-MVP) */}
              {/* <SideItem to="/workspace/usage" icon={<ChartNoAxesColumn size={16} />} label="Usage" /> */}
              <button type="button" className={`side-item side-btn${settingsOpen ? ' open' : ''}`} onClick={() => setSettingsOpen((v) => !v)}>
                <div className="side-icon">
                  <Settings size={16} />
                </div>
                <span className="side-btn-label">
                  Settings
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
                          <span>{l.label}</span>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </nav>
          </div>
          <div className="side-fill" />
        </div>
        <div className="ws-aside-bottom">
          <AccountButton />
        </div>
        <button type="button" aria-label="Collapse sidebar" className="side-collapse">
          <div />
        </button>
      </aside>
      <div className="ws-right">
        <header className="ws-header">
          <div className="ws-header-left" />
          <div className="ws-header-actions">
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

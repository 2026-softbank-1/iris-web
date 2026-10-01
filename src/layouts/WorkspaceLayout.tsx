import {
  Check,
  // ChartNoAxesColumn, // Usage nav item (disabled for now)
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  LayoutGrid,
  LogOut,
  Moon,
  PanelsTopLeft,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/brand';
import { NotificationsButton, TrialBadge } from '../components/HeaderActions';
import { Avatar, Popover, usePopover } from '../components/ui';
import { workspace } from '../data/mock';
import { useAuth, useSessionUser } from '../auth/AuthContext';

const SETTINGS_LINKS = [
  { to: '/workspace', label: 'General', end: true },
  { to: '/workspace/plans', label: 'Plans' },
  { to: '/workspace/billing', label: 'Billing' },
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

function WorkspaceSwitcher() {
  const pop = usePopover();
  const navigate = useNavigate();
  const user = useSessionUser();
  return (
    <div>
      <button type="button" className="ws-switch" data-state={pop.isOpen ? 'open' : 'closed'} onClick={(e) => pop.toggle(e.currentTarget)}>
        <div className="ws-switch-inner">
          <Avatar src={user.avatarUrl} size={24} title={workspace.name} />
          <div className="ws-switch-text">
            <div className="ws-name-row">
              <span className="ws-name truncate">{workspace.name}</span>
              <div className="ws-switch-chevron">
                <ChevronDown size={12} strokeWidth={2.25} />
              </div>
            </div>
            <div className="ws-plan-row">
              <span className="ws-plan">{workspace.plan}</span>
            </div>
          </div>
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} width={240}>
        <div className="menu-label">Workspaces</div>
        <button type="button" className="menu-item" data-active="true" onClick={pop.close}>
          <Avatar src={user.avatarUrl} size={20} title={workspace.name} />
          <span className="truncate">{workspace.name}</span>
          <Check size={14} className="menu-right" />
        </button>
        <div className="menu-sep" />
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            pop.close();
            navigate('/workspace');
          }}
        >
          <Settings size={16} className="menu-icon" />
          Workspace settings
        </button>
        <button type="button" className="menu-item" onClick={pop.close}>
          <Plus size={16} className="menu-icon" />
          New Workspace
        </button>
      </Popover>
    </div>
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
        <button type="button" className="menu-item" onClick={pop.close}>
          <Moon size={16} className="menu-icon" />
          Theme
          <span className="menu-right">Dark</span>
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
  const inSettings = location.pathname === '/workspace' || SETTINGS_LINKS.some((l) => l.to !== '/workspace' && location.pathname.startsWith(l.to));
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
            <div className="ws-switch-wrap">
              <WorkspaceSwitcher />
            </div>
          </div>
          <div className="side-divider" />
          <div className="side-section">
            <nav className="side-nav">
              <SideItem to="/dashboard" icon={<LayoutGrid size={16} />} label="Projects" />
              <SideItem to="/workspace/templates" icon={<PanelsTopLeft size={16} />} label="Templates" />
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
                    <NavLink key={l.to} to={l.to} end={l.end} className="side-link">
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
            <div className="vsep" />
            <TrialBadge />
          </div>
        </header>
        <main className="ws-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

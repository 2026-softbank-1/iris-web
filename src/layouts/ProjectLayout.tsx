import {
  Activity,
  Box,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Network,
  Plus,
  Settings,
  Sparkles,
  User,
  X,
  SendHorizontal,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useMatch, useNavigate, useParams } from 'react-router-dom';
import { LogoMark, RepoIcon } from '../components/brand';
import { NotificationsButton } from '../components/HeaderActions';
import { Avatar, Popover, Tooltip, usePopover } from '../components/ui';
import { apiStatusLabel } from '../data/deploymentModel';
import { timeAgo, workspace, type Project, type Service } from '../data/mock';
import { useProject, useProjectDomains, useProjects } from '../data/ProjectsContext';
import { useAuth, useSessionUser } from '../auth/AuthContext';
import { listDeployments, type DeploymentDto } from '../lib/endpoints';

function ProjectSwitcher({ project }: { project: Project }) {
  const pop = usePopover();
  const navigate = useNavigate();
  const user = useSessionUser();
  const { projects } = useProjects();
  return (
    <div>
      <button type="button" className="ph-btn" aria-label={workspace.name} data-state={pop.isOpen ? 'open' : 'closed'} onClick={(e) => pop.toggle(e.currentTarget)}>
        <Avatar src={user.avatarUrl} size={16} title={workspace.name} />
        <div className="ph-btn-text">{project.name}</div>
        <div className="ph-chevron">
          <ChevronDown size={16} />
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} width={260}>
        <div className="menu-label">{workspace.name}</div>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className="menu-item"
            data-active={p.id === project.id}
            onClick={() => {
              pop.close();
              navigate(`/project/${p.id}`);
            }}
          >
            <LayoutDashboard size={16} className="menu-icon" />
            <span className="truncate">{p.name}</span>
            {p.id === project.id && <Check size={14} className="menu-right" />}
          </button>
        ))}
        <div className="menu-sep" />
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            pop.close();
            navigate('/dashboard');
          }}
        >
          <Layers3 size={16} className="menu-icon" />
          All Projects
        </button>
      </Popover>
    </div>
  );
}

function EnvSwitcher({ project }: { project: Project }) {
  const pop = usePopover();
  return (
    <div className="ph-env">
      <div className="ph-sep ph-sep-env" />
      <button type="button" className="ph-btn ph-env-btn" data-state={pop.isOpen ? 'open' : 'closed'} onClick={(e) => pop.toggle(e.currentTarget)}>
        <div className="ph-env-label">
          <span>{project.environment}</span>
        </div>
        <div className="ph-chevron">
          <ChevronDown size={16} />
        </div>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} width={240}>
        <div className="menu-label">Environments</div>
        <button type="button" className="menu-item" data-active="true" onClick={pop.close}>
          <CircleDot size={16} className="menu-icon" />
          {project.environment}
          <Check size={14} className="menu-right" />
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={pop.close}>
          <Plus size={16} className="menu-icon" />
          New Environment
        </button>
      </Popover>
    </div>
  );
}

function RailItem({ to, label, icon, end, forceActive }: { to: string; label: string; icon: ReactNode; end?: boolean; forceActive?: boolean }) {
  return (
    <Tooltip label={label} side="right">
      <div className="rail-item-wrap">
        <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => `rail-item${isActive || forceActive ? ' active' : ''}`}>
          <div className="side-icon">{icon}</div>
        </NavLink>
      </div>
    </Tooltip>
  );
}

function ActivityDrawer({ project, onClose }: { project: Project; onClose: () => void }) {
  // 서비스마다 최근 배포 요청을 받아 합친다(열 때 한 번).
  const [items, setItems] = useState<{ s: Service; d: DeploymentDto }[] | null>(null);
  const serviceKey = project.services.map((s) => s.id).join(',');
  useEffect(() => {
    let cancelled = false;
    Promise.all(project.services.map(async (s) => (await listDeployments(s.id, 0, 10)).items.map((d) => ({ s, d })))).then(
      (all) => { if (!cancelled) setItems(all.flat().sort((a, b) => +new Date(b.d.createdAt) - +new Date(a.d.createdAt))); },
      () => { if (!cancelled) setItems([]); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceKey]);
  return (
    <div className="side-drawer">
      <div className="side-drawer-head">
        <span>Activity</span>
        <button type="button" className="icon-btn" aria-label="Close activity" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="side-drawer-body">
        {items === null && <p className="activity-empty">Loading…</p>}
        {items?.length === 0 && <p className="activity-empty">No activity yet.</p>}
        {items?.map(({ s, d }) => (
          <div key={d.id} className="activity-item">
            <div className="activity-icon">
              <RepoIcon size={16} />
            </div>
            <div className="activity-text">
              <p>
                <b>{s.name}</b> deployment <span className={`activity-state ${d.status.toLowerCase()}`}>{apiStatusLabel(d.status).toLowerCase()}</span>
              </p>
              <span>
                {d.sourceCommitMessage?.split('\n')[0] ?? `Commit ${d.sourceSha.slice(0, 7)}`} · {timeAgo(d.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentDrawer({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([
    { me: false, text: 'Hi! I can look at your deployments and logs. Ask me why a service crashed.' },
  ]);
  const [draft, setDraft] = useState('');
  const send = () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setMsgs((m) => [
      ...m,
      { me: true, text },
      {
        me: false,
        text: 'Temp_log keeps exiting because SESSION_SECRET is shorter than 48 characters (ZodError in env.js). Set a longer secret in Variables and redeploy.',
      },
    ]);
  };
  return (
    <div className="side-drawer">
      <div className="side-drawer-head">
        <span className="agent-title">
          <Sparkles size={16} /> Agent
        </span>
        <button type="button" className="icon-btn" aria-label="Close agent" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="side-drawer-body agent-body">
        {msgs.map((m, i) => (
          <div key={i} className={`agent-msg${m.me ? ' me' : ''}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="agent-input">
        <input className="input" placeholder="Ask about this project..." value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button type="button" className="btn btn-primary btn-icon-only" aria-label="Send" onClick={send}>
          <SendHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}

export function ProjectLayout() {
  const { projectId } = useParams();
  const { state, project, error } = useProject(projectId);
  useProjectDomains(project);
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<'activity' | 'agent' | null>(null);
  const accountPop = usePopover();
  const auth = useAuth();
  const user = useSessionUser();
  const onService = useMatch('/project/:projectId/service/*');

  useEffect(() => {
    if (project) document.title = project.name;
  }, [project]);

  if (!project) {
    return (
      <div className="not-found">
        <p>{state === 'loading' ? 'Loading project…' : state === 'error' ? `Couldn't load this project. ${error ?? ''}` : 'Project not found'}</p>
        {state !== 'loading' && (
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        )}
      </div>
    );
  }
  const base = `/project/${project.id}`;

  return (
    <div className="proj-shell">
      <div className="proj-header-wrap">
        <header className="proj-header">
          <div className="ph-left">
            <NavLink to="/dashboard" title="Dashboard" className="ph-logo">
              <div>
                <LogoMark size={24} />
              </div>
            </NavLink>
            <div className="ph-crumbs">
              <div className="ph-sep" />
              <ProjectSwitcher project={project} />
              <EnvSwitcher project={project} />
            </div>
          </div>
          <nav className="ph-right">
            <div className="ph-right-inner">
              <div>
                <button
                  type="button"
                  title="Toggle activity"
                  className={`icon-btn${drawer === 'activity' ? ' on' : ''}`}
                  onClick={() => setDrawer((d) => (d === 'activity' ? null : 'activity'))}
                >
                  <Activity size={16} />
                </button>
              </div>
              <NotificationsButton />
              <div className="vsep" />
              <button
                type="button"
                aria-label="Agent"
                title="Open agent panel"
                className={`agent-btn${drawer === 'agent' ? ' on' : ''}`}
                onClick={() => setDrawer((d) => (d === 'agent' ? null : 'agent'))}
              >
                <div className="side-icon">
                  <MessageSquare size={16} />
                </div>
                <span>Agent</span>
              </button>
            </div>
          </nav>
        </header>
      </div>
      <div className="proj-body">
        <nav aria-label="Project navigation" className="proj-rail">
          <div className="rail-items">
            <RailItem to={base} end forceActive={!!onService} label="Architecture" icon={<Network size={16} />} />
            <RailItem to={`${base}/observability`} label="Observability" icon={<ChartNoAxesColumn size={16} />} />
            <RailItem to={`${base}/logs`} label="Logs" icon={<FileText size={16} />} />
            <RailItem to={`${base}/sandboxes`} label="Sandboxes" icon={<Box size={16} />} />
            <RailItem to={`${base}/settings`} label="Settings" icon={<Settings size={16} />} />
          </div>
          <div className="rail-fill" />
          <div>
            <button type="button" className="rail-avatar" data-state={accountPop.isOpen ? 'open' : 'closed'} onClick={(e) => accountPop.toggle(e.currentTarget)}>
              <Avatar src={user.avatarUrl} size={24} title={user.login} />
            </button>
            <Popover anchor={accountPop.anchor} onClose={accountPop.close} side="right" align="end" width={210}>
              <div className="menu-label">@{user.login}</div>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  accountPop.close();
                  navigate('/dashboard');
                }}
              >
                <LayoutDashboard size={16} className="menu-icon" />
                Dashboard
              </button>
              <button type="button" className="menu-item" onClick={accountPop.close}>
                <User size={16} className="menu-icon" />
                Account Settings
              </button>
              <div className="menu-sep" />
              <button
                type="button"
                className="menu-item"
                onClick={async () => {
                  accountPop.close();
                  await auth.logout();
                  navigate('/login');
                }}
              >
                <LogOut size={16} className="menu-icon" />
                Logout
              </button>
            </Popover>
          </div>
        </nav>
        <div className="proj-content">
          <Outlet />
        </div>
        {drawer === 'activity' && <ActivityDrawer project={project} onClose={() => setDrawer(null)} />}
        {drawer === 'agent' && <AgentDrawer onClose={() => setDrawer(null)} />}
      </div>
    </div>
  );
}

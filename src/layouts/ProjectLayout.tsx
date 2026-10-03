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
import { LanguageButton } from '../components/LanguageButton';
import { Avatar, Popover, Tooltip, usePopover } from '../components/ui';
import { activityOf } from '../data/deploymentModel';
import { workspace, type Project, type Service } from '../data/mock';
import { useProject, useProjectDomains, useProjects } from '../data/ProjectsContext';
import { useAuth, useSessionUser } from '../auth/AuthContext';
import { listDeployments, type DeploymentDto } from '../lib/endpoints';
import { formatAgo, useI18n } from '../i18n';

function ProjectSwitcher({ project }: { project: Project }) {
  const pop = usePopover();
  const navigate = useNavigate();
  const user = useSessionUser();
  const { projects } = useProjects();
  const { t } = useI18n();
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
          {t('dash.all')}
        </button>
      </Popover>
    </div>
  );
}

function EnvSwitcher({ project }: { project: Project }) {
  const pop = usePopover();
  const { t } = useI18n();
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
        <div className="menu-label">{t('project.environments')}</div>
        <button type="button" className="menu-item" data-active="true" onClick={pop.close}>
          <CircleDot size={16} className="menu-icon" />
          {project.environment}
          <Check size={14} className="menu-right" />
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={pop.close}>
          <Plus size={16} className="menu-icon" />
          {t('project.newEnvironment')}
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
  const { t, lang } = useI18n();
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
        <span>{t('project.activity')}</span>
        <button type="button" className="icon-btn" aria-label={t('project.closeActivity')} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="side-drawer-body">
        {items === null && <p className="activity-empty">{t('project.loading')}</p>}
        {items?.length === 0 && <p className="activity-empty">{t('project.noActivity')}</p>}
        {items?.map(({ s, d }) => {
          const { noun, state } = activityOf(d);
          return (
            <div key={d.id} className="activity-item">
              <div className="activity-icon">
                <RepoIcon size={16} />
              </div>
              <div className="activity-text">
                <p>
                  <b>{s.name}</b> {t(noun === 'removal' ? 'project.removal' : 'project.deployment')} <span className={`activity-state ${d.status.toLowerCase()}`}>{state}</span>
                </p>
                <span>
                  {d.sourceCommitMessage?.split('\n')[0] ?? t('project.commit', { sha: d.sourceSha.slice(0, 7) })} · {formatAgo(d.createdAt, lang)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  // 첫 인사는 언어를 바꾸면 따라 바뀌도록 상태에 넣지 않고 그릴 때 붙인다.
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([]);
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
        text: t('project.agentReply'),
      },
    ]);
  };
  return (
    <div className="side-drawer">
      <div className="side-drawer-head">
        <span className="agent-title">
          <Sparkles size={16} /> {t('project.agent')}
        </span>
        <button type="button" className="icon-btn" aria-label={t('project.closeAgent')} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="side-drawer-body agent-body">
        {[{ me: false, text: t('project.agentGreeting') }, ...msgs].map((m, i) => (
          <div key={i} className={`agent-msg${m.me ? ' me' : ''}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="agent-input">
        <input className="input" placeholder={t('project.askPlaceholder')} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button type="button" className="btn btn-primary btn-icon-only" aria-label={t('project.send')} onClick={send}>
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
  const { t } = useI18n();

  useEffect(() => {
    if (project) document.title = project.name;
  }, [project]);

  if (!project) {
    return (
      <div className="not-found">
        <p>{state === 'loading' ? t('project.loadingProject') : state === 'error' ? t('project.loadError', { error: error ?? '' }) : t('project.notFound')}</p>
        {state !== 'loading' && (
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            {t('project.backToDashboard')}
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
            <NavLink to="/dashboard" title={t('landing.dashboard')} className="ph-logo">
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
                  title={t('project.toggleActivity')}
                  className={`icon-btn${drawer === 'activity' ? ' on' : ''}`}
                  onClick={() => setDrawer((d) => (d === 'activity' ? null : 'activity'))}
                >
                  <Activity size={16} />
                </button>
              </div>
              <LanguageButton />
              <NotificationsButton />
              <div className="vsep" />
              <button
                type="button"
                aria-label={t('project.agent')}
                title={t('project.openAgent')}
                className={`agent-btn${drawer === 'agent' ? ' on' : ''}`}
                onClick={() => setDrawer((d) => (d === 'agent' ? null : 'agent'))}
              >
                <div className="side-icon">
                  <MessageSquare size={16} />
                </div>
                <span>{t('project.agent')}</span>
              </button>
            </div>
          </nav>
        </header>
      </div>
      <div className="proj-body">
        <nav aria-label={t('project.nav')} className="proj-rail">
          <div className="rail-items">
            <RailItem to={base} end forceActive={!!onService} label={t('project.rail.architecture')} icon={<Network size={16} />} />
            <RailItem to={`${base}/observability`} label={t('project.rail.observability')} icon={<ChartNoAxesColumn size={16} />} />
            <RailItem to={`${base}/logs`} label={t('project.rail.logs')} icon={<FileText size={16} />} />
            <RailItem to={`${base}/sandboxes`} label={t('project.rail.sandboxes')} icon={<Box size={16} />} />
            <RailItem to={`${base}/settings`} label={t('nav.settings')} icon={<Settings size={16} />} />
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
                {t('landing.dashboard')}
              </button>
              <button type="button" className="menu-item" onClick={accountPop.close}>
                <User size={16} className="menu-icon" />
                {t('menu.account')}
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
                {t('menu.logout')}
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

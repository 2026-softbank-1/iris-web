import {
  ChartNoAxesColumn,
  Copy,
  Flag,
  Globe,
  Package,
  Server,
  Settings,
  TriangleAlert,
  Webhook,
  Coins,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useUI } from '../../components/ui';
import { useProject, useProjects } from '../../data/ProjectsContext';
import { describeError } from '../../lib/api';
import type { ProjectUpdate } from '../../lib/endpoints';

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: '', label: 'General', icon: Settings },
  { id: 'usage', label: 'Usage', icon: ChartNoAxesColumn },
  { id: 'environments', label: 'Environments', icon: Server },
  { id: 'variables', label: 'Shared Variables', icon: Globe },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'feature-flags', label: 'Feature Flags', icon: Flag },
  { id: 'tokens', label: 'Tokens', icon: Coins },
  { id: 'integrations', label: 'Integrations', icon: Package },
  { id: 'danger', label: 'Danger', icon: TriangleAlert },
];

export function ProjectSettings() {
  const { projectId, section = '' } = useParams();
  // ProjectLayout 이 프로젝트가 있을 때만 이 페이지를 그린다.
  const project = useProject(projectId).project!;
  const { updateProject, removeProject } = useProjects();
  const navigate = useNavigate();
  const { toast } = useUI();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const dirty = name.trim() !== project.name || desc.trim() !== (project.description ?? '');
  const base = `/project/${project.id}/settings`;

  const save = async () => {
    // 바뀐 것만 보낸다. 설명을 비우면 null 로 지운다.
    const changes: ProjectUpdate = {};
    if (name.trim() !== project.name) changes.name = name.trim();
    if (desc.trim() !== (project.description ?? '')) changes.description = desc.trim() === '' ? null : desc.trim();
    setBusy(true);
    try {
      await updateProject(project.id, changes);
      toast('Project updated');
    } catch (e) {
      toast(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeProject(project.id);
      toast('Project deleted');
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast(describeError(e));
      setBusy(false);
    }
  };
  if (section && !NAV.some((n) => n.id === section)) return <Navigate to={base} replace />;

  return (
    <div className="proj-page-region">
      <div className="proj-frame psettings">
        <header className="ps-head">
          <p>Project Settings</p>
        </header>
        <div className="ps-scroll">
          <div className="ps-layout">
            <nav className="ps-nav">
              {NAV.map((n) => (
                <NavLink key={n.id} to={n.id ? `${base}/${n.id}` : base} end className={({ isActive }) => `ps-nav-item${isActive ? ' active' : ''}`}>
                  <n.icon size={20} />
                  <p>{n.label}</p>
                </NavLink>
              ))}
            </nav>
            <div className="ps-main">
              {section === '' && (
                <>
                  <section className="ps-section">
                    <h4>Project Info</h4>
                    <label className="ps-label">Name</label>
                    <input className="input ps-input" value={name} onChange={(e) => setName(e.target.value)} />
                    <label className="ps-label">Description</label>
                    <input className="input ps-input" placeholder="Optional description of this project" value={desc} onChange={(e) => setDesc(e.target.value)} />
                    <label className="ps-label">Project ID</label>
                    <pre className="ps-id">
                      <span className="mono">{project.id}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Copy project ID"
                        onClick={() => {
                          navigator.clipboard?.writeText(project.id);
                          toast('Project ID copied');
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    </pre>
                    <button type="button" className="btn btn-primary ps-update" disabled={!dirty || !name.trim() || busy} onClick={() => void save()}>
                      Update
                    </button>
                  </section>
                  <section className="ps-section">
                    <h4>Visibility</h4>
                    <p className="ps-p">
                      This project is <b>PRIVATE</b>. Only project members can see it.
                    </p>
                    <button type="button" className="btn btn-primary-outline ps-btn" onClick={() => toast('Visibility change is mocked')}>
                      Change visibility
                    </button>
                  </section>
                  <section className="ps-section">
                    <h4>Generate Template from Project</h4>
                    <p className="ps-p">Turn this project into a one-click template that others can deploy.</p>
                    <button type="button" className="btn btn-outline ps-btn" onClick={() => toast('Template generation is mocked')}>
                      Create Template
                    </button>
                  </section>
                </>
              )}
              {section === 'danger' && (
                <section className="ps-section">
                  <h4>Danger</h4>
                  <p className="ps-p">Deleting the project removes every service in it.</p>
                  <label className="ps-label">
                    Type <b>{project.name}</b> to confirm
                  </label>
                  <input className="input ps-input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                  <button type="button" className="btn btn-danger ps-btn" disabled={confirmName !== project.name || busy} onClick={() => void remove()}>
                    Delete project
                  </button>
                </section>
              )}
              {section !== '' && section !== 'danger' && (
                <section className="ps-section">
                  <h4>{NAV.find((n) => n.id === section)?.label}</h4>
                  <p className="ps-p">Nothing configured here yet.</p>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

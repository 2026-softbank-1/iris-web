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
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { useUI } from '../../components/ui';
import { getProject } from '../../data/mock';

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
  const project = getProject(projectId)!;
  const { toast } = useUI();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState('');
  const dirty = name !== project.name || desc !== '';
  const base = `/project/${project.id}/settings`;
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
                    <button type="button" className="btn btn-primary ps-update" disabled={!dirty} onClick={() => toast('Project updated (mock)')}>
                      Update
                    </button>
                  </section>
                  <section className="ps-section">
                    <h4>Visibility</h4>
                    <p className="ps-p">
                      This project is <b>PRIVATE</b>. Only project members can see it.
                    </p>
                    <button type="button" className="btn btn-purple-outline ps-btn" onClick={() => toast('Visibility change is mocked')}>
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
                  <p className="ps-p">Deleting the project removes every service, deployment and volume in it.</p>
                  <button type="button" className="btn btn-danger ps-btn" onClick={() => toast('Deleting is disabled in the clone')}>
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

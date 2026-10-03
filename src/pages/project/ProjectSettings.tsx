import {
  ChartNoAxesColumn,
  Copy,
  Server,
  Settings,
  TriangleAlert,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useUI } from '../../components/ui';
import { useProject, useProjects } from '../../data/ProjectsContext';
import { ApiError, describeError } from '../../lib/api';
import type { ProjectUpdate } from '../../lib/endpoints';
import { useI18n, type MessageKey } from '../../i18n';

const NAV: { id: string; label: MessageKey; icon: LucideIcon }[] = [
  { id: '', label: 'project.settings.general', icon: Settings },
  { id: 'usage', label: 'project.settings.usage', icon: ChartNoAxesColumn },
  { id: 'environments', label: 'project.environments', icon: Server },
  { id: 'webhooks', label: 'project.settings.webhooks', icon: Webhook },
  { id: 'danger', label: 'project.settings.danger', icon: TriangleAlert },
];

export function ProjectSettings() {
  const { projectId, section = '' } = useParams();
  // ProjectLayout 이 프로젝트가 있을 때만 이 페이지를 그린다.
  const project = useProject(projectId).project!;
  const { updateProject, removeProject } = useProjects();
  const navigate = useNavigate();
  const { toast } = useUI();
  const { t } = useI18n();
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
      toast(t('project.settings.updated'));
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
      toast(t('project.settings.deleted'));
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError && e.code === 'DEPLOYMENT_IN_PROGRESS' ? t('project.settings.deleteInProgress') : describeError(e));
      setBusy(false);
    }
  };
  if (section && !NAV.some((n) => n.id === section)) return <Navigate to={base} replace />;

  return (
    <div className="proj-page-region">
      <div className="proj-frame psettings">
        <header className="ps-head">
          <p>{t('project.settings.title')}</p>
        </header>
        <div className="ps-scroll">
          <div className="ps-layout">
            <nav className="ps-nav">
              {NAV.map((n) => (
                <NavLink key={n.id} to={n.id ? `${base}/${n.id}` : base} end className={({ isActive }) => `ps-nav-item${isActive ? ' active' : ''}`}>
                  <n.icon size={20} />
                  <p>{t(n.label)}</p>
                </NavLink>
              ))}
            </nav>
            <div className="ps-main">
              {section === '' && (
                <>
                  <section className="ps-section">
                    <h4>{t('project.settings.info')}</h4>
                    <label className="ps-label">{t('project.settings.name')}</label>
                    <input className="input ps-input" value={name} onChange={(e) => setName(e.target.value)} />
                    <label className="ps-label">{t('project.settings.description')}</label>
                    <input className="input ps-input" placeholder={t('project.settings.descPlaceholder')} value={desc} onChange={(e) => setDesc(e.target.value)} />
                    <label className="ps-label">{t('project.settings.projectId')}</label>
                    <pre className="ps-id">
                      <span className="mono">{project.id}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('project.settings.copyId')}
                        onClick={() => {
                          navigator.clipboard?.writeText(project.id);
                          toast(t('project.settings.idCopied'));
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    </pre>
                    <button type="button" className="btn btn-primary ps-update" disabled={!dirty || !name.trim() || busy} onClick={() => void save()}>
                      {t('project.settings.update')}
                    </button>
                  </section>
                  <section className="ps-section">
                    <h4>{t('project.settings.visibility')}</h4>
                    <p className="ps-p">
                      {t('project.settings.visibilityPre')}
                      <b>{t('project.settings.private')}</b>
                      {t('project.settings.visibilityPost')}
                    </p>
                    <button type="button" className="btn btn-primary-outline ps-btn" onClick={() => toast(t('project.settings.visibilityToast'))}>
                      {t('project.settings.changeVisibility')}
                    </button>
                  </section>
                  <section className="ps-section">
                    <h4>{t('project.settings.templateTitle')}</h4>
                    <p className="ps-p">{t('project.settings.templateDesc')}</p>
                    <button type="button" className="btn btn-outline ps-btn" onClick={() => toast(t('project.settings.templateToast'))}>
                      {t('project.settings.createTemplate')}
                    </button>
                  </section>
                </>
              )}
              {section === 'danger' && (
                <section className="ps-section">
                  <h4>{t('project.settings.danger')}</h4>
                  <p className="ps-p">{t('project.settings.dangerDesc')}</p>
                  <label className="ps-label">
                    {t('project.settings.confirmPre')}
                    <b>{project.name}</b>
                    {t('project.settings.confirmPost')}
                  </label>
                  <input className="input ps-input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                  <button type="button" className="btn btn-danger ps-btn" disabled={confirmName !== project.name || busy} onClick={() => void remove()}>
                    {t('project.settings.deleteProject')}
                  </button>
                </section>
              )}
              {section !== '' && section !== 'danger' && (
                <section className="ps-section">
                  <h4>{t(NAV.find((n) => n.id === section)!.label)}</h4>
                  <p className="ps-p">{t('project.settings.nothingHere')}</p>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

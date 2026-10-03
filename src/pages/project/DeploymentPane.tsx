import { ChevronRight, CircleCheck, Clock, Code2, GitBranch, Hammer, Rocket, Sparkles, TriangleAlert, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BuilderIcon, RepoIcon } from '../../components/brand';
import { useUI } from '../../components/ui';
import { apiStatusLabel, canRedeploy, deploymentLabel, failureText } from '../../data/deploymentModel';
import { fmtKst, fmtKstFull, type Deployment, type Project, type Service } from '../../data/mock';
import { useDeploymentDetail, useRunner, type DeploymentsApi } from '../../data/useDeployments';
import { AuthorAvatar, DeploymentActions } from './DeploymentRow';
import { LogTable } from './LogTable';

const DTABS = [
  { id: 'details', label: 'Details' },
  { id: 'build', label: 'Build', suffix: 'Logs' },
  { id: 'deploy', label: 'Deploy', suffix: 'Logs' },
  { id: 'http', label: 'Network', suffix: 'Logs' },
];

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <div className="kv-label">
        <p>{label}</p>
      </div>
      <div className="kv-value">{children}</div>
    </div>
  );
}

/** 배포 상태를 한 줄로 설명한다. */
function headlineOf(d: Deployment): string {
  switch (d.status) {
    case 'ACTIVE': return 'Deployment successful';
    case 'REMOVED': return 'Deployment succeeded and was replaced by a newer one';
    case 'TAKEN_DOWN': return 'The deployment was removed from the cluster. The service is offline until you deploy it again';
    case 'REMOVING': return 'Removing the deployment from the cluster…';
    case 'FAILED': return d.trigger === 'REMOVE' ? 'Removing the service failed. The service was not changed' : (failureText(d.failureCode) ?? 'Deployment failed');
    case 'ROLLED_BACK': return 'Deployment failed and was rolled back';
    case 'MANUAL_INTERVENTION': return d.trigger === 'REMOVE' ? 'Removing the service needs manual intervention. The app may still be running' : 'Deployment needs manual intervention';
    default: return `${deploymentLabel(d.status)}…`;
  }
}

function Details({ d, service }: { d: Deployment; service: Service }) {
  const [mode, setMode] = useState<'pretty' | 'code'>('pretty');
  const [statusOpen, setStatusOpen] = useState(false);
  const { detail, error } = useDeploymentDetail(service.id, d.id);
  const remote = service.remote;
  const problem = d.status === 'FAILED' || d.status === 'ROLLED_BACK' || d.status === 'MANUAL_INTERVENTION';
  return (
    <div className="details">
      <div className={`details-status${problem ? ' crashed' : ''}`}>
        <div>
          <button type="button" className="details-status-btn" onClick={() => setStatusOpen((v) => !v)}>
            <div className="details-status-left">
              <div className="side-icon">{problem ? <TriangleAlert size={16} /> : d.isActive ? <Clock size={16} /> : <CircleCheck size={16} />}</div>
              <p>{headlineOf(d)}</p>
            </div>
            <div className="details-status-right">
              <p>{statusOpen ? 'View less' : 'View more'}</p>
              <div className="side-icon">{statusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
            </div>
          </button>
          {statusOpen && (
            <div className="details-timeline">
              {error && <p className="set-muted">{error}</p>}
              {!detail && !error && <p className="set-muted">Loading…</p>}
              {detail?.history.map((h) => {
                const bad = h.toStatus === 'FAILED' || h.toStatus === 'ROLLED_BACK' || h.toStatus === 'MANUAL_INTERVENTION';
                return (
                  <div key={`${h.toStatus}-${h.createdAt}`} className="details-timeline-row">
                    {bad ? <TriangleAlert size={14} className="red" /> : <CircleCheck size={14} />}
                    <span>{apiStatusLabel(h.toStatus)}</span>
                    <span className="set-muted">
                      {fmtKst(h.createdAt)}
                      {h.failureCode ? ` · ${failureText(h.failureCode)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="details-source">
        <p className="details-h">{d.trigger === 'REMOVE' ? 'Removed deployment' : `Deployed via ${d.via ?? 'GitHub'}`}</p>
        <div className="details-box">
          <a href={d.commitUrl} target="_blank" rel="noreferrer" className="details-commit">
            <AuthorAvatar d={d} />
            <div className="details-commit-text">
              <p title={d.message} className="truncate">
                {d.message}
              </p>
              <div className="details-commit-meta">
                <p>{d.repo}</p>
                {d.branch && (
                  <div className="details-branch">
                    <div className="side-icon">
                      <GitBranch size={16} />
                    </div>
                    <p>{d.branch}</p>
                  </div>
                )}
                {d.sourceSha && <p className="mono">{d.sourceSha.slice(0, 7)}</p>}
              </div>
            </div>
          </a>
        </div>
      </div>

      <div className="details-config">
        <div className="details-config-head">
          <p className="details-h">Configuration</p>
          <div role="tablist" className="seg">
            <button type="button" role="tab" data-state={mode === 'pretty' ? 'active' : 'inactive'} onClick={() => setMode('pretty')}>
              <div className="side-icon">
                <Sparkles size={16} />
              </div>
              <p>Pretty</p>
            </button>
            <button type="button" role="tab" data-state={mode === 'code' ? 'active' : 'inactive'} onClick={() => setMode('code')}>
              <div className="side-icon">
                <Code2 size={16} />
              </div>
              <p>Code</p>
            </button>
          </div>
        </div>
        {mode === 'pretty' ? (
          <div role="tabpanel" className="details-cols">
            <div className="details-box col">
              <div className="details-col-head">
                <div className="side-icon">
                  <Hammer size={16} />
                </div>
                <p>Build</p>
              </div>
              <div className="details-col-body">
                <KV label="Builder">
                  <div className="details-builder">
                    <span>{remote?.builder ?? 'Auto-detect'}</span>
                    <BuilderIcon size={20} />
                  </div>
                </KV>
                <hr />
                <KV label="Root directory">{remote?.rootDirectory ?? '/'}</KV>
                <hr />
                <KV label="Build command">{remote?.buildCommand ?? '—'}</KV>
              </div>
            </div>
            <div className="details-box col">
              <div className="details-col-head">
                <div className="side-icon">
                  <Rocket size={16} />
                </div>
                <p>Deploy</p>
              </div>
              <div className="details-col-body">
                <KV label="Targets">{service.region || '—'}</KV>
                <hr className="soft" />
                <KV label="Port">{remote?.port ?? '—'}</KV>
                <hr className="soft" />
                <KV label="Start command">{remote?.startCommand ?? '—'}</KV>
              </div>
            </div>
          </div>
        ) : (
          <pre className="details-code mono">{JSON.stringify(detail ?? { id: d.id, status: d.status }, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export function DeploymentPane({ project, service, deployment, tab, deps }: { project: Project; service: Service; deployment: Deployment; tab?: string; deps: DeploymentsApi }) {
  const { toast } = useUI();
  const { run } = useRunner();
  // 로그 API 가 아직 없어서 처음에는 상세(Details)를 보여준다.
  const current = DTABS.some((t) => t.id === tab) ? tab! : 'details';
  const serviceBase = `/project/${project.id}/service/${service.id}`;
  const base = `${serviceBase}/deployment/${deployment.id}`;
  const status = deploymentLabel(deployment.status);

  return (
    <div className="pane deployment-pane">
      <div className="pane-inner">
        <div className="dp-root">
          <div className="dp-head">
            <div className="dp-head-row">
              <div className="dp-icon">
                <RepoIcon size={24} />
              </div>
              <div className="dp-crumbs">
                <Link to={serviceBase} className="dp-svc">
                  {service.name}
                </Link>
                <span className="dp-slash">/</span>
                <button
                  type="button"
                  className="dp-id mono"
                  title="Copy deployment ID"
                  onClick={() => {
                    navigator.clipboard?.writeText(deployment.id);
                    toast('Deployment ID copied');
                  }}
                >
                  {deployment.shortId}
                </button>
                <div>
                  <span className={`round-pill${deployment.status === 'ACTIVE' ? ' active' : ''}`}>{status}</span>
                </div>
              </div>
              <div className="dp-head-right">
                <DeploymentActions
                  size={16}
                  horizontal
                  className="btn btn-icon-only dp-action"
                  deployment={deployment}
                  onRedeploy={canRedeploy(deployment) ? () => void run(() => deps.redeploy(deployment.id), 'Redeploy requested') : undefined}
                  onRollback={deployment.status === 'REMOVED' ? () => void run(() => deps.rollback(deployment.id), 'Rollback requested') : undefined}
                />
                <time title={fmtKstFull(deployment.createdAt)} className="dp-time">
                  {fmtKst(deployment.createdAt, false)} GMT+9
                </time>
                <Link to={serviceBase} className="btn btn-icon-only dp-close" aria-label="Close">
                  <div className="tool-icon">
                    <X size={16} />
                  </div>
                </Link>
              </div>
            </div>
            <div className="dp-sub" />
          </div>
          <div role="tablist" className="dp-tabs">
            {DTABS.map((t) => (
              <Link
                key={t.id}
                to={`${base}/${t.id}`}
                role="tab"
                aria-selected={current === t.id}
                data-state={current === t.id ? 'active' : 'inactive'}
                className={`dp-tab${current === t.id ? ' active' : ''}`}
              >
                {t.label}
                {t.suffix && <span> {t.suffix}</span>}
                {current === t.id && <div className="pane-tab-line" />}
              </Link>
            ))}
          </div>
          <div role="tabpanel" aria-label={`${DTABS.find((t) => t.id === current)!.label} Logs`} className="dp-panel" data-state="active">
            {current === 'details' && <Details d={deployment} service={service} />}
            {current !== 'details' && <LogTable key={current} kind={current as 'build' | 'deploy' | 'http'} lines={[]} emptyLabel="Logs aren't available yet" />}
          </div>
        </div>
      </div>
    </div>
  );
}

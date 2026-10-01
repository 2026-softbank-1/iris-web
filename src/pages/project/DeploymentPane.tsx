import { ChevronRight, CircleCheck, Code2, GitBranch, Hammer, Rocket, Sparkles, TriangleAlert, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BuilderIcon, RepoIcon } from '../../components/brand';
import { useUI } from '../../components/ui';
import { fmtKst, fmtKstFull, type Deployment, type Project, type Service } from '../../data/mock';
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

function Details({ d, service }: { d: Deployment; service: Service }) {
  const [mode, setMode] = useState<'pretty' | 'code'>('pretty');
  const [varsOpen, setVarsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const crashed = d.status !== 'ACTIVE';
  const config = {
    build: { builder: d.builder.name.toUpperCase(), buildCommand: null, watchPatterns: [] },
    deploy: { region: d.region, numReplicas: d.replicas, restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: d.maxRetries },
  };
  return (
    <div className="details">
      <div className={`details-status${crashed ? ' crashed' : ''}`}>
        <div>
          <button type="button" className="details-status-btn" onClick={() => setStatusOpen((v) => !v)}>
            <div className="details-status-left">
              <div className="side-icon">{crashed ? <TriangleAlert size={16} /> : <CircleCheck size={16} />}</div>
              <p>{crashed ? 'Deployment crashed and was removed' : 'Deployment successful'}</p>
            </div>
            <div className="details-status-right">
              <p>{statusOpen ? 'View less' : 'View more'}</p>
              <div className="side-icon">{statusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
            </div>
          </button>
          {statusOpen && (
            <div className="details-timeline">
              {[
                ['Initialization', 'Completed'],
                ['Build', 'Completed'],
                ['Deploy', crashed ? 'Crashed (exited with code 1)' : 'Completed'],
                ['Post-deploy', crashed ? 'Skipped' : 'Completed'],
              ].map(([k, v]) => (
                <div key={k} className="details-timeline-row">
                  {v.startsWith('Crashed') ? <TriangleAlert size={14} className="red" /> : <CircleCheck size={14} />}
                  <span>{k}</span>
                  <span className="set-muted">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="details-vars">
        <button type="button" className="details-vars-btn" onClick={() => setVarsOpen((v) => !v)}>
          <div className="side-icon" style={{ opacity: d.variablesCount ? 1 : 0 }}>
            {varsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          <p>
            {d.variablesCount} Variable{d.variablesCount === 1 ? '' : 's'}
          </p>
        </button>
        {varsOpen && d.variablesCount > 0 && (
          <div className="details-vars-list mono">
            <div>NODE_ENV=*******</div>
            <div>DATABASE_URL=*******</div>
            <div className="red">SESSION_SECRET=******* (too short)</div>
          </div>
        )}
      </div>

      <div className="details-source">
        <p className="details-h">Deployed via GitHub</p>
        <div className="details-box">
          <a href={d.commitUrl} target="_blank" rel="noreferrer" className="details-commit">
            <AuthorAvatar d={d} />
            <div className="details-commit-text">
              <p title={d.message} className="truncate">
                {d.message}
              </p>
              <div className="details-commit-meta">
                <p>{d.repo}</p>
                <div className="details-branch">
                  <div className="side-icon">
                    <GitBranch size={16} />
                  </div>
                  <p>{d.branch}</p>
                </div>
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
                    <span>
                      {d.builder.name}
                      {d.builder.version && <span className="details-ver"> (v {d.builder.version} )</span>}
                    </span>
                    <BuilderIcon size={20} />
                  </div>
                </KV>
                <hr />
                <KV label="Executable versions">
                  <div className="details-runtimes">
                    {d.runtimes.map((r) => (
                      <div key={r}>{r}</div>
                    ))}
                  </div>
                </KV>
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
                <KV label="Region">{d.region}</KV>
                <hr className="soft" />
                <KV label="Number of replicas">{d.replicas}</KV>
                <hr className="soft" />
                <KV label="Restart policy">{d.restartPolicy}</KV>
                <hr className="soft" />
                <KV label="Restart policy max retries">{d.maxRetries}</KV>
              </div>
            </div>
          </div>
        ) : (
          <pre className="details-code mono">{JSON.stringify({ service: service.name, ...config }, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export function DeploymentPane({ project, service, deployment, tab }: { project: Project; service: Service; deployment: Deployment; tab?: string }) {
  const { toast } = useUI();
  const current = DTABS.some((t) => t.id === tab) ? tab! : 'deploy';
  const serviceBase = `/project/${project.id}/service/${service.id}`;
  const base = `${serviceBase}/deployment/${deployment.id}`;
  const status = deployment.status === 'ACTIVE' ? 'Active' : deployment.status[0] + deployment.status.slice(1).toLowerCase();

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
                <DeploymentActions size={16} horizontal className="btn btn-icon-only dp-action" />
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
            <div className={`dp-sub${deployment.status === 'ACTIVE' && service.domain ? ' has' : ''}`}>
              {deployment.status === 'ACTIVE' && service.domain && (
                <div className="dp-sub-links">
                  <a href={`https://${service.domain}`} target="_blank" rel="noreferrer" className="dp-domain">
                    <span>{service.domain}</span>
                  </a>
                </div>
              )}
            </div>
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
            {current === 'build' && <LogTable key="build" kind="build" lines={deployment.buildLogs} range={deployment.buildRange} explorerHref={`/project/${project.id}/logs`} />}
            {current === 'deploy' && <LogTable key="deploy" kind="deploy" lines={deployment.deployLogs} range={deployment.deployRange} explorerHref={`/project/${project.id}/logs`} />}
            {current === 'http' && (
              <LogTable
                key="http"
                kind="http"
                lines={
                  deployment.status === 'ACTIVE'
                    ? deployment.deployLogs
                        .filter((l) => l.message === 'handled request')
                        .map((l) => ({
                          ...l,
                          message: `GET ${l.attrs?.find((a) => a.key === 'request.uri')?.value} 200`,
                          attrs: [
                            { key: 'duration', value: `${Math.round(Number(l.attrs?.find((a) => a.key === 'duration')?.value ?? 0) * 1000)}ms` },
                            { key: 'edge', value: 'sin1' },
                          ],
                        }))
                    : []
                }
                emptyLabel="No network logs for this deployment"
                explorerHref={`/project/${project.id}/logs`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

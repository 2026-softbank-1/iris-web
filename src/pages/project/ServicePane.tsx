import {
  Clock,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleCheckBig,
  Copy,
  MapPin,
  Globe,
  EyeOff as EyeOffIcon,
  GalleryHorizontalEnd,
  Plus,
  Braces,
  CornerRightDown,
  TriangleAlert,
  X,
  Eye,
  EyeOff,
  Trash2,
  ChevronUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RepoIcon, RuntimeIcon } from '../../components/brand';
import { useUI } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { apiStatusLabel, canRedeploy, canRestart, deploymentLabel, formatDuration } from '../../data/deploymentModel';
import type { Deployment, Project, Service } from '../../data/mock';
import { useDeploymentDetail, useRunner, type DeploymentsApi } from '../../data/useDeployments';
import { isDeploymentInProgress } from '../../lib/endpoints';
import { DeploymentRow } from './DeploymentRow';
import { ServiceMetrics } from './ServiceMetrics';
import { ServiceSettings } from './ServiceSettings';
import { ServiceConsole } from './ServiceConsole';

const TABS: { id: string; label: MessageKey }[] = [
  { id: 'deployments', label: 'service.tab.deployments' },
  { id: 'variables', label: 'service.tab.variables' },
  { id: 'metrics', label: 'service.tab.metrics' },
  { id: 'console', label: 'service.tab.console' },
  { id: 'settings', label: 'nav.settings' },
];

/* ------------------------------------------------------------------ */
/* Deployments tab                                                     */
/* ------------------------------------------------------------------ */

/** 배포 요청의 단계(대기·빌드·배포)와 단계별 소요 시간. 상세 API 에서 받는다. */
function SuccessSteps({ service, deployment }: { service: Service; deployment: Deployment }) {
  const { t } = useI18n();
  const { detail, error } = useDeploymentDetail(service.id, deployment.id);
  if (error) return <p className="st-muted">{error}</p>;
  if (!detail) return <p className="st-muted">{t('service.loading')}</p>;
  // 마지막 단계(성공·실패 등)는 끝난 상태라서 소요 시간이 없다. 진행하는 단계만 보여준다.
  const stages = detail.stages.filter((stage) => isDeploymentInProgress(stage.status));
  return (
    <div className="dep-steps">
      {stages.map((stage) => (
        <div key={stage.status} className="dep-step">
          <CircleCheck size={16} />
          <span>{apiStatusLabel(stage.status)}</span>
          <span className="dep-step-time">{formatDuration(stage.durationSeconds)}</span>
        </div>
      ))}
    </div>
  );
}

function DeploymentsTab({ project, service, deps }: { project: Project; service: Service; deps: DeploymentsApi }) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const active = deps.items.find((d) => d.status === 'ACTIVE');
  const building = deps.items.find((d) => d.isActive);
  const history = deps.items.filter((d) => d !== active && d !== building);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [hideSkipped, setHideSkipped] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const base = `/project/${project.id}/service/${service.id}`;
  const [repoPre, repoPost] = t('service.deployRepo').split('{repo}');
  // 접속되는 주소가 없으면(처음 배포하기 전, 서비스를 내린 뒤) 주소는 있어도 앱이 응답하지 않아서 링크로 열지 않는다.
  const reachable = !!service.domains?.some((d) => d.isConnected);

  return (
    <div className="deps">
      <div className="deps-info">
        <div className="deps-info-left">
          {service.domain ? (
            <>
              <div className={`side-icon${reachable ? ' deps-globe' : ' dim'}`}>
                <Globe size={16} />
              </div>
              {reachable ? (
                <a href={`https://${service.domain}`} target="_blank" rel="noreferrer" className="deps-domain">
                  {service.domain}
                </a>
              ) : (
                <span className="deps-unexposed" title={t('svcSettings.reachableAfter')}>
                  {service.domain}
                </span>
              )}
            </>
          ) : service.domains && (
            <>
              <div className="side-icon dim">
                <EyeOffIcon size={16} />
              </div>
              <Link to={`${base}/settings`} className="deps-unexposed">
                {t('service.unexposed')}
              </Link>
            </>
          )}
        </div>
        <div className="deps-info-right">
          <button type="button" className="btn btn-primary" disabled={busy || !!building} onClick={() => void run(deps.deploy, t('service.deployRequested'))}>
            {t('service.deploy')}
          </button>
          {service.runtime && (
            <div className="deps-meta">
              <span className="deps-runtime">
                <RuntimeIcon size={16} />
                {service.runtime}
              </span>
            </div>
          )}
          {service.region && (
            <div className="deps-meta">
              <div className="side-icon">
                <MapPin size={16} />
              </div>
              <Link to={`${base}/settings`} title={service.region}>
                {service.region}
              </Link>
            </div>
          )}
          {service.replicas > 0 && (
            <div className="deps-meta">
              <div className="side-icon">
                <GalleryHorizontalEnd size={16} />
              </div>
              <Link to={`${base}/settings`}>
                {t(service.replicas === 1 ? 'service.replicaOne' : 'service.replicaOther', { n: service.replicas })}
              </Link>
            </div>
          )}
        </div>
      </div>

      {service.crashedBanner && (
        <div className="deps-warning">
          <div className="deps-warning-icon">
            <TriangleAlert size={20} />
          </div>
          {service.crashedBanner}
          {service.remote?.latestDeployment?.failureCode === 'BUILD_CONFIG_REQUIRED' && (
            <>
              {' '}
              <Link to={`${base}/settings`}>{t('service.openSettings')}</Link>
            </>
          )}
        </div>
      )}

      {building && (
        <div className="deps-active-wrap">
          <div className="deps-active">
            <DeploymentRow d={building} to={`${base}/deployment/${building.id}`} variant="active" />
            <div className="deps-success-wrap">
              <Link className="deps-success progress" to={`${base}/deployment/${building.id}`}>
                <div className="deps-success-left"><Clock size={16} /><p>{t('service.inProgress', { status: deploymentLabel(building.status) })}</p></div>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
      {active ? (
        <div className="deps-active-wrap">
          <div className="deps-active">
            <DeploymentRow
              d={active}
              to={`${base}/deployment/${active.id}`}
              variant="active"
              onRedeploy={() => void run(() => deps.redeploy(active.id), t('service.redeployRequested'))}
              onRestart={canRestart(active, deps.items) ? () => void run(deps.restart, t('service.restartRequested')) : undefined}
            />
            <div className="deps-success-wrap">
              <button type="button" className={`deps-success${stepsOpen ? ' open' : ''}`} onClick={() => setStepsOpen((v) => !v)}>
                <div className="deps-success-left">
                  <div className="side-icon">
                    <CircleCheckBig size={16} />
                  </div>
                  <p>{t('service.deploySuccess')}</p>
                </div>
                <div className="side-icon deps-success-chev">{stepsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
              </button>
              {stepsOpen && <SuccessSteps service={service} deployment={active} />}
            </div>
          </div>
        </div>
      ) : !building ? (
        <div className="deps-empty">
          <p>{deps.loading ? t('service.loadingDeployments') : (deps.error ?? t(deps.removed ? 'service.removedNoActive' : 'service.noActive'))}</p>
          <div className="deps-empty-actions">
            <button type="button" className="btn btn-ghost" disabled={busy || deps.loading} onClick={() => void run(deps.deploy, t('service.deployRequested'))}>
              <span>
                <span>
                  {repoPre}
                  <b>{service.repo}</b>
                  {repoPost}
                </span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {history.length > 0 && (
        <div className="deps-history">
          <div className="deps-history-head">
            <button type="button" className="deps-history-toggle" data-state={historyOpen ? 'open' : 'closed'} onClick={() => setHistoryOpen((v) => !v)}>
              <div className="tool-icon">{historyOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
              <p>{t('service.history')}</p>
            </button>
            <button type="button" className="deps-hide-skipped" onClick={() => setHideSkipped((v) => !v)}>
              {hideSkipped ? t('service.showSkipped') : t('service.hideSkipped')}
            </button>
          </div>
          {historyOpen && (
            <div role="region" aria-label={t('service.history')} className="deps-history-list">
              {history
                .filter((d) => !hideSkipped || d.status !== 'SKIPPED')
                .map((d) => (
                  <DeploymentRow
                    key={d.id}
                    d={d}
                    to={`${base}/deployment/${d.id}`}
                    variant="history"
                    onRedeploy={canRedeploy(d) ? () => void run(() => deps.redeploy(d.id), t('service.redeployRequested')) : undefined}
                    onRollback={d.status === 'REMOVED' ? () => void run(() => deps.rollback(d.id), t('service.rollbackRequested')) : undefined}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variables tab                                                       */
/* ------------------------------------------------------------------ */

type Var = { key: string; value: string };

function useServiceVars(serviceId: string) {
  const storageKey = `ll:vars:${serviceId}`;
  const [vars, setVars] = useState<Var[]>(() => JSON.parse(localStorage.getItem(storageKey) || '[]'));
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(vars)), [vars, storageKey]);
  return [vars, setVars] as const;
}

function VariablesTab({ service }: { service: Service }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const [vars, setVars] = useServiceVars(service.id);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [systemOpen, setSystemOpen] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);

  const add = () => {
    if (!name.trim()) return;
    setVars((v) => [...v.filter((x) => x.key !== name.trim()), { key: name.trim(), value }]);
    setName('');
    setValue('');
    setAdding(false);
  };

  const openRaw = () => {
    setRawText(vars.map((v) => `${v.key}=${JSON.stringify(v.value)}`).join('\n'));
    setRaw(true);
  };

  const saveRaw = () => {
    const parsed: Var[] = [];
    rawText.split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        parsed.push({ key: m[1], value: v });
      }
    });
    setVars(parsed);
    setRaw(false);
  };

  const [emptyPre, emptyPost] = t('service.vars.emptySub').split('{editor}');

  return (
    <div className="vars">
      <div className="vars-head">
        <div className="vars-head-row">
          <div className="vars-title">
            <div>{t('service.vars.title')}</div>
          </div>
          <div className="vars-actions">
            <button type="button" className="btn btn-ghost" onClick={() => toast(t('service.vars.sharedToast'))}>
              <div className="btn-icon">
                <CornerRightDown size={16} />
              </div>
              <span>
                <span className="btn-label-muted">{t('service.vars.shared')}</span>
              </span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={openRaw}>
              <div className="btn-icon">
                <Braces size={16} />
              </div>
              <span>
                <span className="btn-label-muted">{t('service.vars.raw')}</span>
              </span>
            </button>
            <button type="button" className="btn btn-primary-outline" onClick={() => setAdding(true)}>
              <div className="btn-icon">
                <Plus size={16} />
              </div>
              <span>{t('service.vars.new')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="vars-body">
        {adding && (
          <div className="vars-new">
            <input className="input mono" autoFocus placeholder="VARIABLE_NAME" value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <input className="input mono" placeholder={t('service.vars.valuePh')} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" className="btn btn-primary" onClick={add} disabled={!name.trim()}>
              {t('service.vars.add')}
            </button>
            <button type="button" className="btn btn-outline btn-icon-only" aria-label={t('service.vars.cancel')} onClick={() => setAdding(false)}>
              <X size={16} />
            </button>
          </div>
        )}

        {raw ? (
          <div className="vars-raw">
            <p className="vars-raw-hint">{t('service.vars.rawHint')}</p>
            <textarea className="vars-raw-text mono" value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder={'SESSION_SECRET="..."\nPORT=8080'} />
            <div className="vars-raw-actions">
              <button type="button" className="btn btn-outline" onClick={() => setRaw(false)}>
                {t('service.vars.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={saveRaw}>
                {t('service.vars.update')}
              </button>
            </div>
          </div>
        ) : vars.length === 0 ? (
          <div className="vars-empty-wrap">
            <div className="vars-empty">
              <p className="vars-empty-title">{t('service.vars.emptyTitle')}</p>
              <p className="vars-empty-sub">
                {emptyPre}
                <button type="button" onClick={openRaw}>
                  {t('service.vars.raw')}
                </button>
                {emptyPost}
              </p>
            </div>
          </div>
        ) : (
          <div className="vars-table">
            {vars.map((v) => (
              <div key={v.key} className="vars-row">
                <span className="vars-key mono">{v.key}</span>
                <span className="vars-val mono">{revealed.includes(v.key) ? v.value || '""' : '*******'}</span>
                <div className="vars-row-actions">
                  <button type="button" className="icon-btn" aria-label={t('service.vars.reveal')} onClick={() => setRevealed((r) => (r.includes(v.key) ? r.filter((k) => k !== v.key) : [...r, v.key]))}>
                    {revealed.includes(v.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('service.vars.copy')}
                    onClick={() => {
                      navigator.clipboard?.writeText(v.value);
                      toast(t('service.vars.copied', { key: v.key }));
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={t('service.vars.delete')} onClick={() => setVars((all) => all.filter((x) => x.key !== v.key))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="vars-system">
          <div>
            <button type="button" className="vars-system-btn" data-state={systemOpen ? 'open' : 'closed'} onClick={() => setSystemOpen((v) => !v)}>
              <div className="side-icon">{systemOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
              <p>{t('service.vars.platform', { n: service.platformVariables.length })}</p>
            </button>
          </div>
          {systemOpen && (
            <div className="vars-table system">
              {service.platformVariables.map((v) => (
                <div key={v.key} className="vars-row">
                  <span className="vars-key mono">{v.key}</span>
                  <span className="vars-val mono">*******</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pane                                                                */
/* ------------------------------------------------------------------ */

export function ServicePane({ project, service, tab, stacked, deps }: { project: Project; service: Service; tab?: string; stacked: boolean; deps: DeploymentsApi }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const current = TABS.some((x) => x.id === tab) ? tab! : 'deployments';
  const base = `/project/${project.id}/service/${service.id}`;

  return (
    <div className={`pane service-pane${stacked ? ' stacked' : ''}`} onClick={() => stacked && navigate(base + (current === 'deployments' ? '' : `/${current}`))}>
      <div className="pane-inner">
        <div className="pane-head">
          <div className="pane-title-row">
            <div className="pane-title-left">
              <div className="pane-title-group">
                <button type="button" className="pane-svc-icon" aria-label={t('service.icon')}>
                  <div>
                    <RepoIcon size={32} />
                  </div>
                </button>
                <h1 className="pane-title">
                  <button type="button">
                    <span title={service.name}>{service.name}</span>
                  </button>
                </h1>
              </div>
            </div>
            <div className="pane-title-right">
              <Link to={`/project/${project.id}`} className="pane-close" aria-label={t('service.close')} onClick={(e) => e.stopPropagation()}>
                <div className="tool-icon">
                  <X size={16} />
                </div>
              </Link>
            </div>
          </div>
          <div className="pane-tabs">
            {TABS.map((x) => (
              <Link key={x.id} to={x.id === 'deployments' ? base : `${base}/${x.id}`} className={`pane-tab${current === x.id ? ' active' : ''}`}>
                <div>{t(x.label)}</div>
                {current === x.id && <div className="pane-tab-line" />}
              </Link>
            ))}
          </div>
        </div>
        <div className="pane-content">
          <div className={`pane-content-inner${current === 'settings' ? ' flush' : ''}`}>
            {current === 'deployments' && <DeploymentsTab project={project} service={service} deps={deps} />}
            {current === 'variables' && <VariablesTab service={service} />}
            {current === 'metrics' && <ServiceMetrics service={service} />}
            {current === 'console' && <ServiceConsole service={service} />}
            {current === 'settings' && <ServiceSettings project={project} service={service} onScaled={() => void deps.reload()} />}
          </div>
        </div>
      </div>
    </div>
  );
}

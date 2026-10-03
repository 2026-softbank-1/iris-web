import { FailedRepairButton } from './FailedRepairButton';
import { ChevronRight, CircleCheck, Clock, Code2, GitBranch, Hammer, Rocket, Sparkles, TriangleAlert, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BuilderIcon, RepoIcon } from '../../components/brand';
import { useUI } from '../../components/ui';
import { apiStatusLabel, canRedeploy, deploymentLabel, failureKey } from '../../data/deploymentModel';
import { canDiagnose } from '../../data/diagnosisModel';
import { fmtKst, fmtKstFull, type Deployment, type Project, type Service } from '../../data/mock';
import { useI18n, type MessageKey } from '../../i18n';
import { useDeploymentDetail, useRunner, type DeploymentsApi } from '../../data/useDeployments';
import type { DeploymentDetailDto } from '../../lib/endpoints';
import { AuthorAvatar, DeploymentActions } from './DeploymentRow';
import { BuildLogsTab, DeployLogsTab, NetworkLogsTab } from './DeploymentLogs';
import { DiagnosisPanel } from './DiagnosisPanel';

type DTab = { id: 'details' | 'build' | 'deploy' | 'http' | 'diagnosis'; label: MessageKey; logs?: boolean; ai?: boolean };
const DTABS: DTab[] = [
  { id: 'details', label: 'service.dtab.details' },
  { id: 'build', label: 'service.dtab.build', logs: true },
  { id: 'deploy', label: 'service.dtab.deploy', logs: true },
  { id: 'http', label: 'service.dtab.network', logs: true },
];
/** 실패한 배포(canDiagnose)에만 붙는 탭. */
const DIAGNOSIS_TAB: DTab = { id: 'diagnosis', label: 'diag.action', ai: true };

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
function headlineOf(d: Deployment, t: (key: MessageKey) => string): string {
  switch (d.status) {
    case 'ACTIVE': return t('service.deploySuccess');
    case 'REMOVED': return t('service.dp.replaced');
    case 'TAKEN_DOWN': return t('service.dp.takenDown');
    case 'REMOVING': return t('service.dp.removing');
    case 'FAILED': return d.trigger === 'REMOVE' ? t('service.dp.removeFailed') : t(failureKey(d.failureCode) ?? 'service.dp.failed');
    case 'ROLLED_BACK': return t('service.dp.rolledBack');
    case 'MANUAL_INTERVENTION': return t(d.trigger === 'REMOVE' ? 'service.dp.removeManual' : 'service.dp.manual');
    default: return `${deploymentLabel(d.status)}…`;
  }
}

function Details({ d, service, serviceBase, detail, error }: { d: Deployment; service: Service; serviceBase: string; detail: DeploymentDetailDto | null; error: string | null }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'pretty' | 'code'>('pretty');
  const [statusOpen, setStatusOpen] = useState(false);
  // 구성·소스는 상세 응답의 값으로 그린다. 응답을 받기 전(또는 받지 못했을 때)에는 서비스의 지금 설정으로 채운다.
  const remote = service.remote;
  const build = detail?.configuration.build ?? remote;
  const deploy = detail?.configuration.deploy ?? remote;
  const targets = detail ? detail.configuration.deploy.targets.map((x) => x.name).join(', ') : service.region;
  const replacedBy = detail?.replacedBy;
  const problem = d.status === 'FAILED' || d.status === 'ROLLED_BACK' || d.status === 'MANUAL_INTERVENTION';
  return (
    <div className="details">
      <div className={`details-status${problem ? ' crashed' : ''}`}>
        <div>
          <button type="button" className="details-status-btn" onClick={() => setStatusOpen((v) => !v)}>
            <div className="details-status-left">
              <div className="side-icon">{problem ? <TriangleAlert size={16} /> : d.isActive ? <Clock size={16} /> : <CircleCheck size={16} />}</div>
              <p>{headlineOf(d, t)}</p>
            </div>
            <div className="details-status-right">
              <p>{statusOpen ? t('service.dp.viewLess') : t('service.dp.viewMore')}</p>
              <div className="side-icon">{statusOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
            </div>
          </button>
          {replacedBy && (
            <p className="details-status-note">
              <Link to={`${serviceBase}/deployment/${replacedBy.deploymentId}/details`}>{t('service.dp.replacedBy', { id: replacedBy.deploymentId })}</Link>
              <span> · {fmtKst(replacedBy.at)}</span>
            </p>
          )}
          {statusOpen && (
            <div className="details-timeline">
              {error && <p className="set-muted">{error}</p>}
              {!detail && !error && <p className="set-muted">{t('service.loading')}</p>}
              {detail?.history.map((h) => {
                const bad = h.toStatus === 'FAILED' || h.toStatus === 'ROLLED_BACK' || h.toStatus === 'MANUAL_INTERVENTION';
                return (
                  <div key={`${h.toStatus}-${h.createdAt}`} className="details-timeline-row">
                    {bad ? <TriangleAlert size={14} className="red" /> : <CircleCheck size={14} />}
                    <span>{apiStatusLabel(h.toStatus)}</span>
                    <span className="set-muted">
                      {fmtKst(h.createdAt)}
                      {failureKey(h.failureCode) ? ` · ${t(failureKey(h.failureCode)!)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="details-source">
        <p className="details-h">{d.trigger === 'REMOVE' ? t('service.dp.removedDeployment') : t('service.dp.via', { via: d.via ?? 'GitHub' })}</p>
        <div className="details-box">
          <a href={d.commitUrl} target="_blank" rel="noreferrer" className="details-commit">
            <AuthorAvatar d={d} />
            <div className="details-commit-text">
              <p title={d.message} className="truncate">
                {d.message}
              </p>
              <div className="details-commit-meta">
                <p>{detail?.source.repository ?? d.repo}</p>
                {(detail?.source.branch ?? d.branch) && (
                  <div className="details-branch">
                    <div className="side-icon">
                      <GitBranch size={16} />
                    </div>
                    <p>{detail?.source.branch ?? d.branch}</p>
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
          <p className="details-h">{t('service.dp.config')}</p>
          <div role="tablist" className="seg">
            <button type="button" role="tab" data-state={mode === 'pretty' ? 'active' : 'inactive'} onClick={() => setMode('pretty')}>
              <div className="side-icon">
                <Sparkles size={16} />
              </div>
              <p>{t('service.dp.pretty')}</p>
            </button>
            <button type="button" role="tab" data-state={mode === 'code' ? 'active' : 'inactive'} onClick={() => setMode('code')}>
              <div className="side-icon">
                <Code2 size={16} />
              </div>
              <p>{t('service.dp.code')}</p>
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
                <p>{t('service.dtab.build')}</p>
              </div>
              <div className="details-col-body">
                <KV label={t('service.dp.builder')}>
                  <div className="details-builder">
                    <span>{build?.builder ?? t('service.dp.autoDetect')}</span>
                    <BuilderIcon size={20} />
                  </div>
                </KV>
                <hr />
                <KV label={t('service.dp.rootDir')}>{build?.rootDirectory ?? '/'}</KV>
                <hr />
                <KV label={t('service.dp.buildCmd')}>{build?.buildCommand ?? '—'}</KV>
              </div>
            </div>
            <div className="details-box col">
              <div className="details-col-head">
                <div className="side-icon">
                  <Rocket size={16} />
                </div>
                <p>{t('service.dtab.deploy')}</p>
              </div>
              <div className="details-col-body">
                <KV label={t('service.dp.targets')}>{targets || '—'}</KV>
                <hr className="soft" />
                <KV label={t('service.dp.port')}>{deploy?.port ?? '—'}</KV>
                <hr className="soft" />
                <KV label={t('service.dp.startCmd')}>{deploy?.startCommand ?? '—'}</KV>
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
  const { t } = useI18n();
  const { toast } = useUI();
  const { run } = useRunner();
  const navigate = useNavigate();
  // 상세 응답은 Details 의 구성·소스와 Deploy·Network Logs 의 타깃이 쓴다. 진행 중이면 3초마다 다시 받는다.
  const { detail, error: detailError, failure: detailFailure } = useDeploymentDetail(service.id, deployment.id);
  const diagnosable = canDiagnose(deployment);
  const tabs = diagnosable ? [...DTABS, DIAGNOSIS_TAB] : DTABS;
  // 주소에 탭이 없으면 상세(Details)를 보여준다. 진단할 수 없는 배포의 /diagnosis 주소도 상세로 간다.
  const current = tabs.some((x) => x.id === tab) ? tab! : 'details';
  const currentTab = tabs.find((x) => x.id === current)!;
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
                  title={t('service.dp.copyId')}
                  onClick={() => {
                    navigator.clipboard?.writeText(deployment.id);
                    toast(t('service.dp.idCopied'));
                  }}
                >
                  {deployment.shortId}
                </button>
                <div>
                  <span className={`round-pill${deployment.status === 'ACTIVE' ? ' active' : ''}`}>{status}</span>
                </div>
              </div>
              <div className="dp-head-right">
                {diagnosable && <FailedRepairButton serviceId={service.id} deploymentId={deployment.id} to={`${base}/diagnosis`} />}
                <DeploymentActions
                  size={16}
                  horizontal
                  className="btn btn-icon-only dp-action"
                  deployment={deployment}
                  onDiagnose={diagnosable ? () => navigate(`${base}/diagnosis`) : undefined}
                  onRedeploy={canRedeploy(deployment) ? () => void run(() => deps.redeploy(deployment.id), t('service.redeployRequested')) : undefined}
                  onRollback={deployment.status === 'REMOVED' ? () => void run(() => deps.rollback(deployment.id), t('service.rollbackRequested')) : undefined}
                />
                <time title={fmtKstFull(deployment.createdAt)} className="dp-time">
                  {fmtKst(deployment.createdAt, false)} GMT+9
                </time>
                <Link to={serviceBase} className="btn btn-icon-only dp-close" aria-label={t('service.close')}>
                  <div className="tool-icon">
                    <X size={16} />
                  </div>
                </Link>
              </div>
            </div>
            <div className="dp-sub" />
          </div>
          <div role="tablist" className="dp-tabs">
            {tabs.map((x) => (
              <Link
                key={x.id}
                to={`${base}/${x.id}`}
                role="tab"
                aria-selected={current === x.id}
                data-state={current === x.id ? 'active' : 'inactive'}
                className={`dp-tab${current === x.id ? ' active' : ''}`}
              >
                {x.ai ? (
                  <span className="dp-tab-ai">
                    <Sparkles size={14} />
                    {t(x.label)}
                  </span>
                ) : (
                  t(x.label)
                )}
                {x.logs && <span> {t('service.dtab.logs')}</span>}
                {current === x.id && <div className="pane-tab-line" />}
              </Link>
            ))}
          </div>
          <div role="tabpanel" aria-label={currentTab.ai ? t(currentTab.label) : `${t(currentTab.label)} ${t('service.dtab.logs')}`} className="dp-panel" data-state="active">
            {current === 'details' && <Details d={deployment} service={service} serviceBase={serviceBase} detail={detail} error={detailError} />}
            {current === 'diagnosis' && <DiagnosisPanel key={deployment.id} service={service} deployment={deployment} base={base} />}
            {current === 'build' && <BuildLogsTab key={deployment.id} service={service} deployment={deployment} serviceBase={serviceBase} />}
            {current === 'deploy' && <DeployLogsTab key={deployment.id} service={service} deployment={deployment} detail={detail} detailError={detailFailure} />}
            {current === 'http' && <NetworkLogsTab key={deployment.id} service={service} deployment={deployment} detail={detail} detailError={detailFailure} />}
          </div>
        </div>
      </div>
    </div>
  );
}

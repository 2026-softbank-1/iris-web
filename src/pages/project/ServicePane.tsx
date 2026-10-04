import {
  Check,
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
  Pencil,
  Link2,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnalysisGateBadge } from '../../components/AnalysisGateBadge';
import { RepoIcon, RuntimeIcon } from '../../components/brand';
import { useUI } from '../../components/ui';
import { VariableIssueList, issueId } from '../../components/VariableIssues';
import { useI18n, type MessageKey } from '../../i18n';
import { canDiagnose, canDiagnoseApi } from '../../data/diagnosisModel';
import { apiStatusLabel, canRedeploy, canRestart, deploymentLabel, formatDuration, renderMsg } from '../../data/deploymentModel';
import type { Deployment, Project, Service } from '../../data/mock';
import { useDeployBlock } from '../../data/useDeployBlock';
import { useDeploymentDetail, useRunner, type DeploymentsApi } from '../../data/useDeployments';
import { describeRawError, describeVariablesError, useServiceVariables } from '../../data/useServiceVariables';
import { initialVariableValue, mergeUploadedEnvironment, toRaw } from '../../data/variablesModel';
import { useVariablesValidation } from '../../data/useVariablesValidation';
import { ApiError } from '../../lib/api';
import { isDeploymentInProgress, variablesInvalidIssues, type VariableDto, type VariableIssueDto } from '../../lib/endpoints';
import { DatabaseTab } from './DatabasePane';
import { DatabaseSettings } from './DatabaseSettings';
import { ReferenceVariableForm } from './ReferenceVariableForm';
import { DeploymentRow } from './DeploymentRow';
import { DiagnosisBrief } from './DiagnosisBrief';
import { ServiceMetrics } from './ServiceMetrics';
import { ServiceSettings } from './ServiceSettings';
import { ServiceConsole } from './ServiceConsole';

const DB_TAB = { id: 'database', label: 'stack.tab.database' as MessageKey };
const DB_HIDDEN_TABS = ['console'];
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
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { busy, run } = useRunner();
  // 배포 요청이 422 VARIABLES_INVALID 로 거절되면 이슈를 탭 위에 보여 준다(Variables 탭에서 고치도록).
  const [invalid, setInvalid] = useState<VariableIssueDto[] | null>(null);
  const onInvalid = (e: unknown) => {
    if (!(e instanceof ApiError) || e.code !== 'VARIABLES_INVALID') return false;
    setInvalid(variablesInvalidIssues(e));
    return true;
  };
  // 거절되면 같은 요청을 검증 없이 다시 보낼 수 있게 skip 인자를 받는 형태로 기억한다.
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const runChecked = (task: (skip: boolean) => Promise<unknown>, message: string, skip = false): Promise<void> => {
    setInvalid(null);
    setRetry(null);
    return run(() => task(skip), message, (e) => {
      const handled = onInvalid(e);
      if (handled) setRetry(() => () => void runChecked(task, message, true));
      return handled;
    });
  };
  const database = service.remote?.kind === 'DATABASE';
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
  const diagnosisTo = (id: string | number) => `${base}/deployment/${id}/diagnosis`;
  // 실패 배너가 가리키는 것은 가장 최근 배포다. 진단할 수 있는 실패(REMOVE 가 아닌)일 때만 그 진단 결과를 배너 아래에 보여 준다.
  const latest = service.remote?.latestDeployment;
  // 연결되지 않은 내 서버에 배포하는 서비스는 배포를 만드는 버튼을 모두 막는다.
  const deployBlock = useDeployBlock(service.id);

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
          ) : service.domains && !database && (
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
          <button type="button" className={`btn btn-primary${deployBlock.blocked ? ' deploy-blocked' : ''}`} disabled={busy || !!building || deployBlock.blocked} title={deployBlock.reason} onClick={() => void runChecked((skip) => deps.deploy(skip), t('service.deployRequested'))}>
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

      {invalid && (
        <div className="deps-warning var-blocked" role="alert">
          <div className="deps-warning-head">
            <div className="deps-warning-icon"><TriangleAlert size={20} /></div>
            <span>{t('stack.deploy.blocked')}</span>{' '}
            <Link to={`${base}/variables`}>{t('stack.deploy.openVariables')}</Link>
          </div>
          {invalid.length > 0 && <VariableIssueList issues={invalid} services={project.services} />}
          {retry && <div className="var-blocked-actions"><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={retry}>{t('stack.deploy.skip')}</button><span className="st-muted">{t('stack.deploy.skipHint')}</span></div>}
        </div>
      )}

      {deployBlock.blocked && (
        <p className="deploy-blocked-note" role="status">
          {deployBlock.reason} <Link to="/workspace/servers">{t('servers.manage')}</Link>
        </p>
      )}

      {service.crashedBanner && (
        <div className="deps-warning">
          <div className="deps-warning-head">
            <div className="deps-warning-icon">
              <TriangleAlert size={20} />
            </div>
            {renderMsg(t, service.crashedBanner, lang === 'ja' ? '' : ' ')}
            {service.remote?.latestDeployment?.failureCode === 'BUILD_CONFIG_REQUIRED' && (
              <>
                {' '}
                <Link to={`${base}/settings`}>{t('service.openSettings')}</Link>
              </>
            )}
          </div>
          {latest && canDiagnoseApi(latest) && <DiagnosisBrief key={latest.id} service={service} deploymentId={String(latest.id)} updatedAt={latest.updatedAt} to={diagnosisTo(latest.id)} />}
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
              onRedeploy={() => void runChecked((skip) => deps.redeploy(active.id, skip), t('service.redeployRequested'))}
              onRestart={canRestart(active, deps.items) ? () => void runChecked((skip) => deps.restart(skip), t('service.restartRequested')) : undefined}
              deployBlockedReason={deployBlock.reason}
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
            <button type="button" className={`btn btn-ghost${deployBlock.blocked ? ' deploy-blocked' : ''}`} disabled={busy || deps.loading || deployBlock.blocked} title={deployBlock.reason} onClick={() => void runChecked((skip) => deps.deploy(skip), t('service.deployRequested'))}>
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
                    serviceId={service.id}
                    onDiagnose={canDiagnose(d) ? () => navigate(diagnosisTo(d.id)) : undefined}
                    onRedeploy={canRedeploy(d) ? () => void runChecked((skip) => deps.redeploy(d.id, skip), t('service.redeployRequested')) : undefined}
                    onRollback={d.status === 'REMOVED' ? () => void run(() => deps.rollback(d.id), t('service.rollbackRequested')) : undefined}
                    deployBlockedReason={deployBlock.reason}
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

/** 참조 변수가 가리키는 곳: `postgres.url` (프로젝트에서 사라진 서비스는 #id). */
const referenceLabel = (project: Project, ref: { serviceId: number; property: string }) =>
  `← ${project.services.find((s) => s.id === String(ref.serviceId))?.name ?? `#${ref.serviceId}`}.${ref.property}`;

function VariablesTab({ project, service }: { project: Project; service: Service }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const vars = useServiceVariables(service.id);
  const validation = useVariablesValidation(service.id, vars.variables);
  const [refForm, setRefForm] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [defaultSuggested, setDefaultSuggested] = useState(false);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [systemOpen, setSystemOpen] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  /** 쓰기 요청 하나. 성공하면 true 이고, 실패하면 이유를 화면에 띄우고 false 다. */
  const attempt = async (task: () => Promise<void>, describe: (e: unknown) => string = (e) => describeVariablesError(e, t)) => {
    setProblem(null);
    try {
      await task();
      return true;
    } catch (e) {
      setProblem(describe(e));
      return false;
    }
  };

  const closeAdd = () => {
    setDefaultSuggested(false);
    setProblem(null);
    setName('');
    setValue('');
    setAdding(false);
  };

  const closeRaw = () => {
    setProblem(null);
    setRaw(false);
    setRawText('');
  };

  const add = async () => {
    const key = name.trim();
    if (!key) return;
    if (!(await attempt(() => vars.add(key, value)))) return;
    setName('');
    setValue('');
    setAdding(false);
  };

  const startEdit = (v: VariableDto) => {
    setProblem(null);
    if (v.reference) {
      setAdding(false);
      setRefForm(v.key);
      return;
    }
    setEditing(v.key);
    setEditValue(v.value ?? '');
  };

  /** 검증 제안 한 번에 적용: 그 키를 제안한 서비스 연결 정보를 가리키는 참조 변수로 만든다(있던 값은 대체). */
  const applySuggestion = async (issue: VariableIssueDto) => {
    const reference = issue.suggestion?.reference;
    if (!reference) return;
    setApplying(issueId(issue));
    const exists = vars.variables.some((v) => v.key === issue.key);
    if (await attempt(() => vars.setReference(issue.key, reference, exists))) toast(t('stack.vars.referenced', { key: issue.key }));
    setApplying(null);
  };

  const saveEdit = async () => {
    if (editing === null) return;
    if (await attempt(() => vars.update(editing, editValue))) setEditing(null);
  };

  const remove = async (key: string) => {
    if (await attempt(() => vars.remove(key))) setRevealed((r) => r.filter((k) => k !== key));
  };

  const openAdd = (key = '') => {
    setProblem(null); setName(key); setAdding(true);
    const existing = vars.variables.find(v => v.key === key);
    if (existing && !existing.reference) { setAdding(false); setEditing(existing.key); setEditValue(existing.value ?? ''); setDefaultSuggested(false); return; }
    setValue(initialVariableValue(key));
    setDefaultSuggested(key === 'SESSION_SECRET');
  };
  useEffect(() => {
    if (!vars.ready) return;
    const action = searchParams.get('action');
    if (action !== 'add' && action !== 'upload') return;
    const key = (searchParams.get('keys') ?? '').split(',').find(k => /^[A-Z][A-Z0-9_]{0,127}$/.test(k)) ?? '';
    if (action === 'add') openAdd(key);
    else { setRaw(true); setRawText(toRaw(vars.variables)); }
    const next = new URLSearchParams(searchParams); next.delete('action'); next.delete('keys'); setSearchParams(next, { replace: true });
  }, [vars.ready, searchParams]);
  const uploadEnvironment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('large');
      const text = await file.text();
      setRawText(mergeUploadedEnvironment(vars.variables, text)); setRaw(true); setProblem(null);
    } catch { setProblem(t('repair.environment.fileError')); }
  };

  const openRaw = () => {
    setProblem(null);
    setRawText(toRaw(vars.variables));
    setRaw(true);
  };

  // 형식이 틀린 줄이 있으면 서버가 아무것도 바꾸지 않고 422 를 준다.
  const saveRaw = async () => {
    if (!(await attempt(() => vars.replaceAll(rawText, vars.variables), (e) => describeRawError(e, t)))) return;
    setRaw(false);
    setRawText('');
    toast(t('service.vars.updated'));
  };

  // 캔버스가 Esc 로 패널을 닫으니, 이 탭의 입력창에서는 Esc 를 여기서 막아 쓰던 내용이 사라지지 않게 한다.
  // 한글 같은 IME 로 글자를 확정하는 Enter 는 입력의 일부라서, 추가·저장으로 받지 않는다.
  const composing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229;

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!composing(e)) closeAdd();
    } else if (e.key === 'Enter' && !composing(e)) void add();
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!composing(e)) setEditing(null);
    } else if (e.key === 'Enter' && !composing(e)) void saveEdit();
  };

  // 이름은 영문·숫자·밑줄만 남긴다. 붙여 넣은 이름 앞뒤의 공백이 `_` 로 바뀌지 않게 먼저 잘라 내고, 직접 친 공백은 `_` 가 된다.
  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const pasted = (e.nativeEvent as InputEvent).inputType === 'insertFromPaste';
    const key = (pasted ? e.target.value.trim() : e.target.value).replace(/[^A-Za-z0-9_]/g, '_');
    setName(key);
    if (key === 'SESSION_SECRET' && !value && !vars.variables.some(v => v.key === key)) { setValue(initialVariableValue(key)); setDefaultSuggested(true); }
  };

  // Raw 편집기는 붙여 넣은 긴 텍스트가 들어 있을 수 있어서 Esc 로 닫지 않고, 취소 버튼으로만 닫는다.
  const onRawKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') e.stopPropagation();
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
            <button type="button" className="btn btn-ghost" disabled={!vars.ready} onClick={openRaw}>
              <div className="btn-icon">
                <Braces size={16} />
              </div>
              <span>
                <span className="btn-label-muted">{t('service.vars.raw')}</span>
              </span>
            </button>
            <button type="button" className="btn btn-ghost" disabled={!vars.ready} onClick={() => { setAdding(false); setProblem(null); setRefForm(''); }}>
              <div className="btn-icon">
                <Link2 size={16} />
              </div>
              <span>
                <span className="btn-label-muted">{t('stack.vars.addReference')}</span>
              </span>
            </button>
            <button type="button" className="btn btn-primary-outline" disabled={!vars.ready} onClick={() => { setRefForm(null); openAdd(); }}>
              <div className="btn-icon">
                <Plus size={16} />
              </div>
              <span>{t('service.vars.new')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="vars-body">
        <p className="vars-note">{t('service.vars.note')}</p>
        <input ref={uploadInput} type="file" hidden aria-label={t('repair.environment.upload')} onChange={e => void uploadEnvironment(e)} />
        <button className="btn btn-outline btn-sm" disabled={!vars.ready || vars.busy} onClick={() => uploadInput.current?.click()}>{t('repair.environment.upload')}</button>
        {adding && defaultSuggested && <p className="vars-note">{t('repair.environment.defaultNote')}</p>}
        {problem && (
          <p className="vars-note error" role="alert">
            {problem}
          </p>
        )}

        {vars.ready && !validation.loading && !validation.failed && (
          validation.issues.length > 0 ? (
            <section className="var-validation" aria-label={t('stack.vars.validation')}>
              <h3>{t('stack.vars.validation')} <span className="gate-code">{t('stack.vars.issueCount', { n: validation.issues.length })}</span></h3>
              <p className="vars-note">{t('stack.vars.validationNote')}</p>
              <VariableIssueList issues={validation.issues} services={project.services} onApply={(issue) => void applySuggestion(issue)} applying={applying} />
            </section>
          ) : (
            <p className="var-validation-ok"><ShieldCheck size={16} aria-hidden /> {t('stack.vars.validationOk')}</p>
          )
        )}

        {refForm !== null && (
          <ReferenceVariableForm
            project={project}
            service={service}
            existing={vars.variables}
            initialKey={refForm}
            busy={vars.busy}
            onCancel={() => setRefForm(null)}
            onSave={async (key, reference) => {
              if (await attempt(() => vars.setReference(key, reference, vars.variables.some((v) => v.key === key)))) {
                setRefForm(null);
                toast(t('stack.vars.referenced', { key }));
              }
            }}
          />
        )}

        {adding && (
          <div className="vars-new">
            <input className="input mono" autoFocus placeholder="VARIABLE_NAME" value={name} onChange={onNameChange} onKeyDown={onAddKey} />
            <input type="password" className="input mono" placeholder={t('service.vars.valuePh')} autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onAddKey} />
            <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={!name.trim() || vars.busy}>
              {t('service.vars.add')}
            </button>
            <button type="button" className="btn btn-outline btn-icon-only" aria-label={t('service.vars.cancel')} onClick={closeAdd}>
              <X size={16} />
            </button>
          </div>
        )}

        {raw ? (
          <div className="vars-raw">
            <p className="vars-note">{t('repair.environment.uploadNote')}</p>
            <p className="vars-raw-hint">{t('service.vars.rawHint')}</p>
            {vars.variables.some((v) => v.reference) && <p className="vars-note">{t('stack.vars.rawRefs')}</p>}
            <p className="vars-note warn">{t('service.vars.rawWarn')}</p>
            <textarea className="vars-raw-text mono" autoComplete="off" spellCheck={false} value={rawText} onChange={(e) => setRawText(e.target.value)} onKeyDown={onRawKey} placeholder={'DATABASE_URL="postgres://..."\nLOG_LEVEL=info'} />
            <div className="vars-raw-actions">
              <button type="button" className="btn btn-outline" onClick={closeRaw}>
                {t('service.vars.cancel')}
              </button>
              <button type="button" className="btn btn-primary" disabled={vars.busy} onClick={() => void saveRaw()}>
                {vars.busy ? t('service.vars.updating') : t('service.vars.update')}
              </button>
            </div>
          </div>
        ) : vars.loading ? (
          <p className="vars-note">{t('service.vars.loading')}</p>
        ) : vars.error ? (
          <div className="vars-load-error">
            <p className="vars-note error">{describeVariablesError(vars.error.error, t)}</p>
            <button type="button" className="btn btn-outline" onClick={vars.retry}>
              {t('service.vars.retry')}
            </button>
          </div>
        ) : vars.variables.length === 0 ? (
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
            {vars.variables.map((v) =>
              editing === v.key ? (
                <div key={v.key} className="vars-row">
                  <span className="vars-key mono">{v.key}</span>
                  <input
                    className="input mono"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t('service.vars.valueOf', { key: v.key })}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={onEditKey}
                  />
                  <div className="vars-row-actions">
                    <button type="button" className="icon-btn" aria-label={t('service.vars.save')} disabled={vars.busy} onClick={() => void saveEdit()}>
                      <Check size={14} />
                    </button>
                    <button type="button" className="icon-btn" aria-label={t('service.vars.cancel')} onClick={() => setEditing(null)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={v.key} className="vars-row">
                  <span className="vars-key mono">{v.key}</span>
                  {v.reference ? (
                    <span className="vars-val vars-ref" title={v.resolved}>
                      <Link2 size={13} aria-hidden />
                      <span className="mono">{referenceLabel(project, v.reference)}</span>
                      {v.resolved && <span className="vars-ref-preview mono">{v.resolved}</span>}
                    </span>
                  ) : (
                    <span className="vars-val mono">{revealed.includes(v.key) ? v.value || '""' : '*******'}</span>
                  )}
                  <div className="vars-row-actions">
                    {!v.reference && (
                      <button type="button" className="icon-btn" aria-label={t('service.vars.reveal')} onClick={() => setRevealed((r) => (r.includes(v.key) ? r.filter((k) => k !== v.key) : [...r, v.key]))}>
                        {revealed.includes(v.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                    {!v.reference && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('service.vars.copy')}
                        onClick={() => {
                          navigator.clipboard?.writeText(v.value ?? '');
                          toast(t('service.vars.copied', { key: v.key }));
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    <button type="button" className="icon-btn" aria-label={t('service.vars.edit')} disabled={vars.busy} onClick={() => startEdit(v)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="icon-btn" aria-label={t('service.vars.delete')} disabled={vars.busy} onClick={() => void remove(v.key)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {vars.ready && (
          <div className="vars-system">
            <div>
              <button type="button" className="vars-system-btn" data-state={systemOpen ? 'open' : 'closed'} onClick={() => setSystemOpen((v) => !v)}>
                <div className="side-icon">{systemOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                <p>{t('service.vars.platform', { n: vars.systemVariables.length })}</p>
              </button>
            </div>
            {systemOpen && (
              <div className="vars-table system">
                {vars.systemVariables.map((v) => (
                  <div key={v.key} className="vars-row" title={v.description}>
                    <span className="vars-key mono">{v.key}</span>
                    <span className="vars-desc">{v.description}</span>
                    <span className="vars-val mono">{v.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
  const database = service.remote?.kind === 'DATABASE';
  // 관리형 DB 는 연결 정보 탭이 첫 탭이고, 접속할 콘솔(앱 셸)은 없다.
  const tabs = database ? [DB_TAB, ...TABS.filter((x) => !DB_HIDDEN_TABS.includes(x.id))] : TABS;
  const current = tabs.some((x) => x.id === tab) ? tab! : database ? 'database' : 'deployments';
  const base = `/project/${project.id}/service/${service.id}`;

  return (
    <div className={`pane service-pane${stacked ? ' stacked' : ''}`} onClick={() => stacked && navigate(base + (current === (database ? 'database' : 'deployments') ? '' : `/${current}`))}>
      <div className="pane-inner">
        <div className="pane-head">
          <div className="pane-title-row">
            <div className="pane-title-left">
              <div className="pane-title-group">
                <button type="button" className="pane-svc-icon" aria-label={t('service.icon')}>
                  <div>
                    {database ? <Database size={32} aria-hidden /> : <RepoIcon size={32} />}
                  </div>
                </button>
                <h1 className="pane-title">
                  <button type="button">
                    <span title={service.name}>{service.name}</span>
                  </button>
                </h1>
                <AnalysisGateBadge gate={service.remote?.analysisGate} />
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
            {tabs.map((x) => (
              <Link key={x.id} to={x.id === (database ? 'database' : 'deployments') ? base : `${base}/${x.id}`} className={`pane-tab${current === x.id ? ' active' : ''}`}>
                <div>{t(x.label)}</div>
                {current === x.id && <div className="pane-tab-line" />}
              </Link>
            ))}
          </div>
        </div>
        <div className="pane-content">
          <div className={`pane-content-inner${current === 'settings' && !database ? ' flush' : ''}`}>
            {current === 'database' && <DatabaseTab project={project} service={service} />}
            {current === 'deployments' && <DeploymentsTab project={project} service={service} deps={deps} />}
            {current === 'variables' && <VariablesTab key={service.id} project={project} service={service} />}
            {current === 'metrics' && <ServiceMetrics service={service} />}
            {current === 'console' && <ServiceConsole service={service} />}
            {current === 'settings' && (database ? <DatabaseSettings project={project} service={service} /> : <ServiceSettings project={project} service={service} onScaled={() => void deps.reload()} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

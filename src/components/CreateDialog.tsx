import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Database, FolderGit2, Lock, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../data/ProjectsContext';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { isTargetDeployable, isTargetSupported } from '../lib/endpoints';
import { targetLabel } from '../data/targetModel';
import { useI18n, type MessageKey } from '../i18n';
import { networkingErrorKey } from '../data/networkingError';
import { useRepositoryAnalysis } from '../data/useRepositoryAnalysis';
import { RepoAnalysisStep, slugify, toApplyDependencies, toApplyUnits, toDepDrafts, toUnitDrafts, type DepDraft, type UnitDraft } from './RepoAnalysisStep';
import { DataLossNotice, ENGINE_LABEL } from './DatabaseBits';
import { OnpremServerDialog } from './OnpremServerDialog';
import { TargetPicker } from './TargetPicker';
import { Dialog, useUI } from './ui';
import './CreateDialog.css';

const GITHUB: MessageKey = 'create.opt.github';
const DATABASE: MessageKey = 'create.opt.database';
const STORAGE_OPTIONS = [1, 2, 5, 10, 20];
// 붙여넣은 주소로 보는 입력. 서버(resolve)가 owner/repo, git@ 형식도 받지만 검색어와 구분하려고 주소 형태만 본다.
const URL_LIKE = /^(https?:\/\/|github\.com\/)/i;
// 서비스 이름은 도메인에 쓰이므로 DNS 레이블 규칙(소문자·숫자·하이픈)을 따른다. 서버와 같은 규칙이다.
const SERVICE_NAME_PATTERN = '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?';
// 분석기는 레포 루트 기준 POSIX 상대경로를 쓴다. 입력의 앞뒤 '/' 를 떼고, 루트('/'·'.'·빈 값)면 보내지 않는다.
const analysisRoot = (value: string) => {
  const trimmed = value.trim().replace(/^\.?\/+|\/+$/g, '');
  return trimmed && trimmed !== '.' ? trimmed : undefined;
};

type RepoList = { status: 'loading' | 'ready' | 'error'; items: api.RepositoryDto[]; error?: string };
type UrlCheck = { status: 'idle' | 'validating' | 'invalid' | 'valid'; repo?: api.RepositoryDto };

export function CreateDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const navigate = useNavigate();
  const { toast } = useUI();
  const { t } = useI18n();
  const { targets, servers, createProject, createService, removeProject, refreshService, refreshProject } = useProjects();
  const [step, setStep] = useState<'create' | 'repos' | 'review' | 'analysis' | 'database'>('create');
  const [dbEngine, setDbEngine] = useState<api.DatabaseEngine>('postgres');
  const [dbName, setDbName] = useState('postgres');
  const [dbStorage, setDbStorage] = useState(5);
  // 데이터베이스는 프로젝트 안에서만 추가한다(새 프로젝트를 만드는 흐름에는 없다).
  const options: MessageKey[] = [GITHUB, ...(projectId ? [DATABASE] : []), 'create.opt.folder'];
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [installations, setInstallations] = useState<api.InstallationDto[] | null>(null);
  const [installationId, setInstallationId] = useState<number | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [repos, setRepos] = useState<RepoList>({ status: 'loading', items: [] });
  const [urlCheck, setUrlCheck] = useState<UrlCheck>({ status: 'idle' });
  const [repo, setRepo] = useState<api.RepositoryDto | null>(null);
  const [projectName, setProjectName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [root, setRoot] = useState('/');
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [targetId, setTargetId] = useState<number>();
  const [submitting, setSubmitting] = useState(false);
  const analysis = useRepositoryAnalysis();
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);
  const [depDrafts, setDepDrafts] = useState<DepDraft[]>([]);
  // 레포 구성 확인은 프로젝트 아래에서 돈다. 새 프로젝트로 만들 때는 확인을 시작하면서 프로젝트를 먼저 만들고,
  // 서비스를 하나도 만들지 않은 채 창을 닫거나 검토로 돌아가면 그 빈 프로젝트를 지운다.
  const draftProject = useRef<string | null>(null);
  // 내 서버 추가 창을 여는 동안 이 창은 숨긴다(상태는 그대로 두고, Esc 가 두 창을 한꺼번에 닫지 않게).
  const [addingServer, setAddingServer] = useState(false);

  const isUrl = URL_LIKE.test(query.trim());
  const selectedTarget = targets.find((target) => target.id === targetId && isTargetSupported(target));
  // 연결되지 않은 내 서버를 골랐으면 서비스만 만들고 첫 배포는 하지 않는다(서버가 409 TARGET_NOT_CONNECTED 로 거절한다).
  const canDeployNow = !selectedTarget || isTargetDeployable(selectedTarget);

  useEffect(() => {
    if (!open) return;
    setStep('create');
    setQuery('');
    setNotice('');
    setRepo(null);
    setInstallationId(undefined);
    setSubmitting(false);
    setDrafts([]);
    setDepDrafts([]);
    setAddingServer(false);
    analysis.reset();
  }, [open, analysis.reset]);

  // 저장소 선택 단계: GitHub App 을 설치한 계정 목록
  useEffect(() => {
    if (!open || step !== 'repos') return;
    let cancelled = false;
    api.listInstallations().then(
      (list) => { if (!cancelled) setInstallations(list); },
      (e) => { if (!cancelled) setNotice(describeError(e)); },
    );
    return () => { cancelled = true; };
  }, [open, step, refresh]);

  // 저장소 검색(접근 권한이 있는 저장소만 나온다)
  useEffect(() => {
    if (!open || step !== 'repos' || isUrl) return;
    let cancelled = false;
    setRepos((r) => ({ ...r, status: 'loading' }));
    const timer = window.setTimeout(() => {
      api.searchRepositories({ q: query.trim() || undefined, installationId }).then(
        (page) => { if (!cancelled) setRepos({ status: 'ready', items: page.items }); },
        (e) => { if (!cancelled) setRepos({ status: 'error', items: [], error: describeError(e) }); },
      );
    }, query ? 300 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, step, isUrl, query, installationId, refresh]);

  // 붙여넣은 주소 확인(저장소가 있고 접근 권한이 있는지)
  useEffect(() => {
    if (!open || step !== 'repos' || !isUrl) { setUrlCheck({ status: 'idle' }); return; }
    let cancelled = false;
    setUrlCheck({ status: 'validating' });
    const timer = window.setTimeout(() => {
      api.resolveRepository(query.trim()).then(
        (found) => { if (!cancelled) setUrlCheck({ status: 'valid', repo: found }); },
        (e) => {
          if (cancelled) return;
          setUrlCheck({ status: 'invalid' });
          // 403(접근 불가)·422(주소 형식)는 "찾을 수 없음" 화면으로 충분하다. 그 밖의 오류만 알린다.
          if (!(e instanceof ApiError && (e.status === 403 || e.status === 422))) setNotice(describeError(e));
        },
      );
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, step, isUrl, query]);

  // 검토 단계: 선택한 저장소의 브랜치
  useEffect(() => {
    if (!open || step !== 'review' || !repo) return;
    let cancelled = false;
    setBranches([repo.defaultBranch]);
    api.listBranches(repo.fullName).then(
      (list) => { if (!cancelled) setBranches(list.map((b) => b.name)); },
      (e) => { if (!cancelled) setNotice(describeError(e)); },
    );
    return () => { cancelled = true; };
  }, [open, step, repo]);

  // 타깃 목록이 늦게 도착해도 선택을 채운다. AWS가 없으면 첫 지원 타깃을 쓴다.
  useEffect(() => {
    if (!open || step !== 'review' || targets.length === 0) return;
    setTargetId((current) => {
      if (targets.some((target) => target.id === current && isTargetSupported(target))) return current;
      return (targets.find((target) => target.name === 'aws' && isTargetSupported(target))
        ?? targets.find((target) => target.kind === 'AWS')
        ?? targets.find(isTargetSupported))?.id;
    });
  }, [open, step, targets]);

  const select = (value: api.RepositoryDto) => {
    const name = value.fullName.split('/')[1];
    setRepo(value);
    setProjectName(name);
    setServiceName(slugify(name));
    setBranch(value.defaultBranch);
    setRoot('/');
    setAutoDeploy(true);
    setTargetId(undefined);
    setStep('review');
    setNotice('');
  };

  const goInstall = () => window.location.assign(api.githubInstallUrl());

  const discardDraftProject = useCallback(() => {
    const id = draftProject.current;
    draftProject.current = null;
    if (id) void removeProject(id).catch(() => undefined);
  }, [removeProject]);

  const ensureProject = async () => {
    if (projectId) return projectId;
    if (draftProject.current) return draftProject.current;
    const project = await createProject({ name: projectName.trim() });
    draftProject.current = project.id;
    return project.id;
  };

  const close = () => {
    analysis.reset();
    discardDraftProject();
    onClose();
  };

  /** 서비스 하나를 만들고 첫 배포를 요청한다(기존 경로). skip 결과로 만들 때는 analysisId 를 함께 보낸다. */
  const deploy = async (analysisId?: number) => {
    if (!repo || !serviceName.trim() || !branch.trim() || !selectedTarget || submitting) return;
    setSubmitting(true);
    setNotice('');
    // 이 호출에서 새로 만든 프로젝트만 실패 때 되돌린다(레포 구성 확인 중인 프로젝트는 분석이 쓰고 있다).
    const reusing = draftProject.current !== null;
    try {
      const targetProject = await ensureProject();
      const service = await createService(targetProject, {
        repositoryUrl: repo.url,
        name: serviceName.trim(),
        branch: branch.trim(),
        rootDirectory: root.trim() || undefined,
        isAutoDeploy: autoDeploy,
        targetIds: [selectedTarget.id],
        ...(analysisId !== undefined && { analysisId }),
      });
      draftProject.current = null; // 서비스가 생겼으니 프로젝트는 남긴다
      // 서비스를 만든 직후 첫 배포를 요청한다. 이것만 실패하면 서비스는 남겨 두고 알려 준다.
      // 연결되지 않은 내 서버에는 아직 배포할 수 없어서 서비스만 만든다.
      let deploymentId: number | null = null;
      if (!canDeployNow) {
        toast(t('servers.createdWaiting'));
      } else {
        try {
          const deployment = await api.createDeployment(service.id, { triggerType: 'MANUAL' }, crypto.randomUUID());
          deploymentId = deployment.id;
          void refreshService(targetProject, service.id).catch(() => undefined);
        } catch (e) {
          toast(t('create.firstDeployFailed', { error: describeError(e) }));
        }
      }
      analysis.reset();
      onClose();
      const base = `/project/${targetProject}/service/${service.id}`;
      navigate(deploymentId === null ? base : `${base}/deployment/${deploymentId}`);
    } catch (e) {
      // 서비스 만들기가 실패했으면 방금 만든 빈 프로젝트를 되돌린다.
      if (!reusing) discardDraftProject();
      setNotice(describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 관리형 DB 서비스를 만들고(자동 배포 접수) 그 서비스의 연결 정보 화면으로 간다. */
  const createDb = async () => {
    if (!projectId || submitting) return;
    setSubmitting(true);
    setNotice('');
    try {
      const db = await api.createDatabase(projectId, { name: dbName.trim(), engine: dbEngine, storageGi: dbStorage, ...(selectedTarget && { targetIds: [selectedTarget.id] }) });
      await refreshProject(projectId).catch(() => undefined);
      toast(t('create.db.created', { name: db.name }));
      onClose();
      navigate(`/project/${projectId}/service/${db.id}`);
    } catch (e) {
      const key = networkingErrorKey(e);
      setNotice(key ? t(key) : describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 레포 구성 확인을 시작한다. force 는 트리아지 결과와 관계없이 배포 단위를 분석한다. */
  const checkRepo = async (mode: api.AnalysisMode) => {
    if (!repo || !branch.trim() || !selectedTarget || submitting) return;
    setNotice('');
    setDrafts([]);
    setDepDrafts([]);
    setStep('analysis');
    let targetProject: string;
    try {
      targetProject = await ensureProject();
    } catch (e) {
      setStep('review');
      setNotice(describeError(e));
      return;
    }
    await analysis.start(targetProject, {
      sourceRepositoryUrl: repo.url,
      githubInstallationId: repo.installationId,
      sourceBranch: branch.trim(),
      rootDirectory: analysisRoot(root),
      mode,
    });
  };

  // 분석이 끝나 배포 단위가 나오면 편집할 초안을 만든다(분석 id 가 바뀔 때만).
  const doneAnalysis = analysis.state.phase === 'done' ? analysis.state.analysis : null;
  useEffect(() => {
    if (doneAnalysis?.result.decision === 'analyze') {
      setDrafts(toUnitDrafts(doneAnalysis.result.units));
      setDepDrafts(toDepDrafts(doneAnalysis.result.dependencies));
    }
  }, [doneAnalysis?.id]);

  /** 고른 배포 단위마다 서비스를 만들고 배포를 요청한 뒤 프로젝트 캔버스로 간다. */
  const applyUnits = async () => {
    if (!doneAnalysis || submitting) return;
    const built = toApplyUnits(drafts);
    if ('error' in built) { setNotice(t(built.error)); return; }
    const deps = toApplyDependencies(selectedTarget?.kind === 'ONPREM' ? depDrafts.map((d) => ({ ...d, provision: false })) : depDrafts, built.units.map((u) => u.name));
    if ('error' in deps) { setNotice(t(deps.error)); return; }
    setSubmitting(true);
    setNotice('');
    const targetProject = String(doneAnalysis.projectId);
    try {
      const applied = await api.applyRepositoryAnalysis(targetProject, doneAnalysis.id, {
        units: built.units,
        ...(deps.dependencies.length > 0 && { dependencies: deps.dependencies }),
        // 연결되지 않은 내 서버면 서비스만 만들고 배포는 서버가 연결된 뒤에 한다.
        deploy: canDeployNow,
        targetIds: selectedTarget ? [selectedTarget.id] : undefined,
      });
      draftProject.current = null;
      await refreshProject(targetProject).catch(() => undefined);
      const blocked = applied.variableIssues?.some((v) => v.issues.some((i) => i.severity === 'error')) ? applied.variableIssues : null;
      toast(!canDeployNow ? t('servers.appliedWaiting', { n: applied.services.length }) : blocked ? t('create.gate.appliedNoDeploy', { n: applied.services.length }) : applied.databases?.length ? t('create.gate.appliedWithDb', { n: applied.services.length, db: applied.databases.length }) : t('create.gate.applied', { n: applied.services.length }));
      analysis.reset();
      onClose();
      navigate(`/project/${targetProject}`, blocked ? { state: { variableIssues: blocked } } : undefined);
    } catch (e) {
      const key = networkingErrorKey(e);
      setNotice(key ? t(key) : describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const backToReview = () => {
    analysis.reset();
    discardDraftProject();
    setStep('review');
    setNotice('');
  };

  const noInstallation = installations !== null && installations.length === 0;
  const branchOptions = branches.includes(branch) ? branches : [branch, ...branches];
  const reviewInvalid = submitting || !selectedTarget || !serviceName.trim() || !branch.trim() || (!projectId && !projectName.trim());

  const title: MessageKey = step === 'review' ? 'create.reviewTitle' : step === 'analysis' ? 'create.gate.title' : step === 'database' ? 'create.db.title' : 'create.title';
  const wide = step === 'analysis' && analysis.state.phase === 'done' && analysis.state.analysis.result.decision === 'analyze';
  return <><Dialog open={open && !addingServer} onClose={close} className={`create-dialog${wide ? ' wide' : ''}`} label={t('create.title')}>
    <header><h2>{t(title)}</h2><button className="create-icon" aria-label={t('create.dismiss')} onClick={close}><X size={18} /></button></header>
    {step !== 'create' && <button className="create-back" disabled={submitting} onClick={() => { if (step === 'analysis') { backToReview(); return; } setStep(step === 'review' ? 'repos' : 'create'); setNotice(''); }}><ArrowLeft size={15} /> {t('create.back')}</button>}
    {step === 'create' && <><input autoFocus role="combobox" aria-expanded="true" aria-controls="create-options" aria-label={t('create.prompt')} placeholder={t('create.prompt')} value={query} onChange={e => setQuery(e.target.value)} /><div id="create-options" className="create-options">{options.filter(o => t(o).toLowerCase().includes(query.toLowerCase())).map(option => option === GITHUB
        ? <button key={option} onClick={() => { setStep('repos'); setQuery(''); }}><FolderGit2 size={17} />{t(option)}</button>
        : option === DATABASE
        ? <button key={option} onClick={() => { setStep('database'); setQuery(''); setNotice(''); }}><Database size={17} />{t(option)}</button>
        : <button key={option} disabled><Plus size={17} />{t(option)}<span className="create-soon">{t('create.comingSoon')}</span></button>)}</div></>}
    {step === 'database' && <form className="create-review" onSubmit={e => { e.preventDefault(); void createDb(); }}>
      <fieldset className="create-engines"><legend>{t('create.db.engine')}</legend>
        {api.DATABASE_ENGINES.map(engine => <label key={engine} className={dbEngine === engine ? 'on' : undefined}><input type="radio" name="create-db-engine" checked={dbEngine === engine} onChange={() => { if (dbName === dbEngine) setDbName(engine); setDbEngine(engine); }} /><Database size={16} aria-hidden />{ENGINE_LABEL[engine]}</label>)}
      </fieldset>
      <label>{t('create.serviceName')}<input required maxLength={63} pattern={SERVICE_NAME_PATTERN} title={t('create.serviceNameRule')} value={dbName} onChange={e => setDbName(e.target.value)} /></label>
      <label>{t('create.db.storage')}<select value={dbStorage} onChange={e => setDbStorage(Number(e.target.value))}>{STORAGE_OPTIONS.map(n => <option key={n} value={n}>{n} GiB</option>)}</select></label>
      <p className="create-hint">{t('create.db.hint')} {t('stack.db.sizeFixed')}</p>
      <DataLossNotice />
      <div className="create-submit"><button type="submit" className="btn btn-primary" disabled={submitting || !dbName.trim()}>{t(submitting ? 'create.db.creating' : 'create.db.create')}</button></div>
    </form>}
    {step === 'repos' && <>
      <p className="diag-muted">{t('repair.authorizationNote')}</p>
      <div className="create-search"><Search size={17} /><input autoFocus aria-label={t('create.searchRepos')} placeholder={t('create.searchRepos')} value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="create-repo-actions">
        <button onClick={goInstall}>{t('create.configureApp')}</button>
        {installations !== null && installations.length > 1 && <select aria-label={t('create.githubAccount')} value={installationId ?? ''} onChange={e => setInstallationId(e.target.value ? Number(e.target.value) : undefined)}><option value="">{t('create.allAccounts')}</option>{installations.map(i => <option key={i.installationId} value={i.installationId}>{i.accountLogin}</option>)}</select>}
        <button onClick={() => setRefresh(n => n + 1)}>{t('create.refreshRepos')}</button>
      </div>
      {isUrl
        ? urlCheck.status === 'valid' && urlCheck.repo
          ? <div className="create-options"><button onClick={() => select(urlCheck.repo!)}><FolderGit2 size={17} />{urlCheck.repo.fullName}{urlCheck.repo.isPrivate && <Lock size={13} />}</button></div>
          : urlCheck.status === 'invalid'
            ? <div className="create-empty"><h3>{t('create.notFoundTitle')}</h3><p>{t('create.notFoundBody')}</p><p>{t('create.notFoundHint')}</p><button className="btn btn-secondary" onClick={goInstall}>{t('create.grantAccess')}</button></div>
            : <div className="create-empty" role="status"><h3>{t('create.validatingTitle')}</h3><p>{t('create.validatingBody')}</p></div>
        : noInstallation
          ? <div className="create-empty"><h3>{t('create.installTitle')}</h3><p>{t('create.installBody')}</p><button className="btn btn-secondary" onClick={goInstall}>{t('create.installApp')}</button></div>
          : repos.status === 'error'
            ? <div className="create-empty" role="alert"><h3>{t('create.loadReposError')}</h3><p>{repos.error}</p></div>
            : repos.status === 'loading' && repos.items.length === 0
              ? <div className="create-empty" role="status"><p>{t('create.loadingRepos')}</p></div>
              : <div className="create-options">{repos.items.map(r => <button key={r.fullName} onClick={() => select(r)}><FolderGit2 size={17} />{r.fullName}{r.isPrivate && <Lock size={13} />}</button>)}{repos.items.length === 0 && <p className="create-empty">{t('create.noRepos')}</p>}</div>}
    </>}
    {step === 'review' && repo && <form onSubmit={e => { e.preventDefault(); void checkRepo('auto'); }} className="create-review">
      <div className="create-source"><FolderGit2 size={18} />{repo.fullName}</div>
      {!projectId && <label>{t('create.projectName')}<input required maxLength={100} value={projectName} onChange={e => setProjectName(e.target.value)} /></label>}
      <label>{t('create.serviceName')}<input required maxLength={63} pattern={SERVICE_NAME_PATTERN} title={t('create.serviceNameRule')} value={serviceName} onChange={e => setServiceName(e.target.value)} /></label>
      <div className="create-fields">
        <label>{t('create.branch')}<select required value={branch} onChange={e => setBranch(e.target.value)}>{branchOptions.map(b => <option key={b}>{b}</option>)}</select></label>
        <label>{t('create.rootDir')}<input value={root} onChange={e => setRoot(e.target.value)} /></label>
      </div>
      <fieldset className="create-checks"><legend>{t('create.deployTo')}</legend>
        <TargetPicker name="create-target" value={targetId} onChange={setTargetId} onAddServer={() => setAddingServer(true)} unsupportedClassName="create-unsupported" noteClassName="create-soon" unsupportedLabel={t('create.notSupported')} />
      </fieldset>
      <label className="create-check"><input type="checkbox" checked={autoDeploy} onChange={e => setAutoDeploy(e.target.checked)} />{t('create.autoDeploy')}</label>
      {!selectedTarget && <p className="create-notice" role="status">{t('create.targetsUnavailable')}</p>}
      {selectedTarget && !canDeployNow && <p className="create-notice" role="status">{t('servers.notConnectedNotice', { name: targetLabel(selectedTarget, servers) })}</p>}
      <p className="create-hint">{t('create.checkRepoHint')}</p>
      <div className="create-submit">
        <button type="button" className="btn btn-ghost" disabled={reviewInvalid} onClick={e => { const form = e.currentTarget.form; if (form?.reportValidity()) void deploy(); }}>{t(submitting ? 'create.deploying' : canDeployNow ? 'create.skipCheck' : 'servers.createOnlySkipCheck')}</button>
        <button type="submit" className="btn btn-primary" disabled={reviewInvalid}>{t('create.checkRepo')}</button>
      </div>
    </form>}
    {step === 'analysis' && repo && <div className="create-review">
      <div className="create-source"><FolderGit2 size={18} />{repo.fullName}<span className="create-source-branch mono">{branch}{analysisRoot(root) ? ` · ${analysisRoot(root)}` : ''}</span></div>
      <RepoAnalysisStep
        state={analysis.state}
        busy={submitting}
        drafts={drafts}
        onDrafts={setDrafts}
        onPrem={selectedTarget?.kind === 'ONPREM'}
        depDrafts={depDrafts}
        onDepDrafts={setDepDrafts}
        onDeploySimple={(id) => void deploy(id)}
        onFallback={() => void deploy()}
        onForce={() => void checkRepo('force')}
        onRetry={() => void checkRepo(analysis.state.phase === 'failed' && analysis.state.analysis?.mode === 'force' ? 'force' : 'auto')}
        onApply={() => void applyUnits()}
      />
      {selectedTarget && !canDeployNow && <p className="create-notice" role="status">{t('servers.notConnectedNotice', { name: targetLabel(selectedTarget, servers) })}</p>}
    </div>}
    {notice && <p className="create-notice" role="status">{notice}</p>}
  </Dialog>
  <OnpremServerDialog open={open && addingServer} onClose={() => setAddingServer(false)} onCreated={(server) => setTargetId(server.targetId)} closeLabel="servers.dialog.backToCreate" />
  </>;
}

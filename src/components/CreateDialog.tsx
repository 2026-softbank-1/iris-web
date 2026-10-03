import { useEffect, useState } from 'react';
import { ArrowLeft, FolderGit2, Lock, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../data/ProjectsContext';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { isTargetSupported } from '../lib/endpoints';
import { useI18n, type MessageKey } from '../i18n';
import { Dialog, useUI } from './ui';
import './CreateDialog.css';

const GITHUB: MessageKey = 'create.opt.github';
const options: MessageKey[] = [GITHUB, 'create.opt.folder'];
// 붙여넣은 주소로 보는 입력. 서버(resolve)가 owner/repo, git@ 형식도 받지만 검색어와 구분하려고 주소 형태만 본다.
const URL_LIKE = /^(https?:\/\/|github\.com\/)/i;
// 서비스 이름은 도메인에 쓰이므로 DNS 레이블 규칙(소문자·숫자·하이픈)을 따른다. 서버와 같은 규칙이다.
const SERVICE_NAME_PATTERN = '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?';
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '') || 'service';

type RepoList = { status: 'loading' | 'ready' | 'error'; items: api.RepositoryDto[]; error?: string };
type UrlCheck = { status: 'idle' | 'validating' | 'invalid' | 'valid'; repo?: api.RepositoryDto };

export function CreateDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const navigate = useNavigate();
  const { toast } = useUI();
  const { t } = useI18n();
  const { targets, createProject, createService, removeProject, refreshService } = useProjects();
  const [step, setStep] = useState<'create' | 'repos' | 'review'>('create');
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

  const isUrl = URL_LIKE.test(query.trim());
  const selectedTarget = targets.find((target) => target.id === targetId && isTargetSupported(target));

  useEffect(() => {
    if (!open) return;
    setStep('create');
    setQuery('');
    setNotice('');
    setRepo(null);
    setInstallationId(undefined);
    setSubmitting(false);
  }, [open]);

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

  const deploy = async () => {
    if (!repo || !serviceName.trim() || !branch.trim() || !selectedTarget || submitting) return;
    setSubmitting(true);
    setNotice('');
    let createdProjectId: string | null = null;
    try {
      let targetProject = projectId;
      if (!targetProject) {
        const project = await createProject({ name: projectName.trim() });
        targetProject = createdProjectId = project.id;
      }
      const service = await createService(targetProject, {
        repositoryUrl: repo.url,
        name: serviceName.trim(),
        branch: branch.trim(),
        rootDirectory: root.trim() || undefined,
        isAutoDeploy: autoDeploy,
        targetIds: [selectedTarget.id],
      });
      // 서비스를 만든 직후 첫 배포를 요청한다. 이것만 실패하면 서비스는 남겨 두고 알려 준다.
      let deploymentId: number | null = null;
      try {
        const deployment = await api.createDeployment(service.id, { triggerType: 'MANUAL' }, crypto.randomUUID());
        deploymentId = deployment.id;
        void refreshService(targetProject, service.id).catch(() => undefined);
      } catch (e) {
        toast(t('create.firstDeployFailed', { error: describeError(e) }));
      }
      onClose();
      const base = `/project/${targetProject}/service/${service.id}`;
      navigate(deploymentId === null ? base : `${base}/deployment/${deploymentId}`);
    } catch (e) {
      // 서비스 만들기가 실패했으면 방금 만든 빈 프로젝트를 되돌린다.
      if (createdProjectId) await removeProject(createdProjectId).catch(() => undefined);
      setNotice(describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const noInstallation = installations !== null && installations.length === 0;
  const branchOptions = branches.includes(branch) ? branches : [branch, ...branches];

  return <Dialog open={open} onClose={onClose} className="create-dialog" label={t('create.title')}>
    <header><h2>{t(step === 'review' ? 'create.reviewTitle' : 'create.title')}</h2><button className="create-icon" aria-label={t('create.dismiss')} onClick={onClose}><X size={18} /></button></header>
    {step !== 'create' && <button className="create-back" onClick={() => { setStep(step === 'review' ? 'repos' : 'create'); setNotice(''); }}><ArrowLeft size={15} /> {t('create.back')}</button>}
    {step === 'create' && <><input autoFocus role="combobox" aria-expanded="true" aria-controls="create-options" aria-label={t('create.prompt')} placeholder={t('create.prompt')} value={query} onChange={e => setQuery(e.target.value)} /><div id="create-options" className="create-options">{options.filter(o => t(o).toLowerCase().includes(query.toLowerCase())).map(option => option === GITHUB
        ? <button key={option} onClick={() => { setStep('repos'); setQuery(''); }}><FolderGit2 size={17} />{t(option)}</button>
        : <button key={option} disabled><Plus size={17} />{t(option)}<span className="create-soon">{t('create.comingSoon')}</span></button>)}</div></>}
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
    {step === 'review' && repo && <form onSubmit={e => { e.preventDefault(); void deploy(); }} className="create-review">
      <div className="create-source"><FolderGit2 size={18} />{repo.fullName}</div>
      {!projectId && <label>{t('create.projectName')}<input required maxLength={100} value={projectName} onChange={e => setProjectName(e.target.value)} /></label>}
      <label>{t('create.serviceName')}<input required maxLength={63} pattern={SERVICE_NAME_PATTERN} title={t('create.serviceNameRule')} value={serviceName} onChange={e => setServiceName(e.target.value)} /></label>
      <div className="create-fields">
        <label>{t('create.branch')}<select required value={branch} onChange={e => setBranch(e.target.value)}>{branchOptions.map(b => <option key={b}>{b}</option>)}</select></label>
        <label>{t('create.rootDir')}<input value={root} onChange={e => setRoot(e.target.value)} /></label>
      </div>
      {targets.length > 0 && <fieldset className="create-checks"><legend>{t('create.deployTo')}</legend>{targets.map(tg => { const supported = isTargetSupported(tg); return <label key={tg.id} className={supported ? undefined : 'create-unsupported'} title={supported ? undefined : t('create.notSupported')}><input type="radio" name="create-target" disabled={!supported} checked={supported && targetId === tg.id} onChange={() => setTargetId(tg.id)} />{tg.name}{!supported && <span className="create-soon">{t('create.notSupported')}</span>}</label>; })}</fieldset>}
      <label className="create-check"><input type="checkbox" checked={autoDeploy} onChange={e => setAutoDeploy(e.target.checked)} />{t('create.autoDeploy')}</label>
      {!selectedTarget && <p className="create-notice" role="status">{t('create.targetsUnavailable')}</p>}
      <button type="submit" className="btn btn-primary" disabled={submitting || !selectedTarget || !serviceName.trim() || !branch.trim() || (!projectId && !projectName.trim())}>{t(submitting ? 'create.deploying' : 'create.deploy')}</button>
    </form>}
    {notice && <p className="create-notice" role="status">{notice}</p>}
  </Dialog>;
}

import { useEffect, useState } from 'react';
import { ArrowLeft, FolderGit2, Lock, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../data/ProjectsContext';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { isTargetSupported } from '../lib/endpoints';
import { Dialog } from './ui';
import './CreateDialog.css';

const options = ['GitHub Repository', 'Database', 'Template', 'Docker Image', 'Function', 'Bucket', 'Volume', 'Empty Service'];
// 붙여넣은 주소로 보는 입력. 서버(resolve)가 owner/repo, git@ 형식도 받지만 검색어와 구분하려고 주소 형태만 본다.
const URL_LIKE = /^(https?:\/\/|github\.com\/)/i;
// 서비스 이름은 도메인에 쓰이므로 DNS 레이블 규칙(소문자·숫자·하이픈)을 따른다. 서버와 같은 규칙이다.
const SERVICE_NAME_PATTERN = '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?';
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '') || 'service';

type RepoList = { status: 'loading' | 'ready' | 'error'; items: api.RepositoryDto[]; error?: string };
type UrlCheck = { status: 'idle' | 'validating' | 'invalid' | 'valid'; repo?: api.RepositoryDto };

export function CreateDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const navigate = useNavigate();
  const { targets, createProject, createService, removeProject } = useProjects();
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
  const [targetIds, setTargetIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isUrl = URL_LIKE.test(query.trim());

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

  const select = (value: api.RepositoryDto) => {
    const name = value.fullName.split('/')[1];
    setRepo(value);
    setProjectName(name);
    setServiceName(slugify(name));
    setBranch(value.defaultBranch);
    setRoot('/');
    setAutoDeploy(true);
    setTargetIds(targets.filter(isTargetSupported).map((t) => t.id));
    setStep('review');
    setNotice('');
  };

  const goInstall = () => window.location.assign(api.githubInstallUrl());

  const deploy = async () => {
    if (!repo || !serviceName.trim() || !branch.trim() || submitting) return;
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
        // 타깃을 불러오지 못했으면 생략한다(서버는 모든 타깃에 배포한다).
        targetIds: targetIds.length > 0 ? targetIds : undefined,
      });
      onClose();
      navigate(`/project/${targetProject}/service/${service.id}`);
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

  return <Dialog open={open} onClose={onClose} className="create-dialog" label="Create">
    <header><h2>{step === 'review' ? 'Review deployment' : 'Create'}</h2><button className="create-icon" aria-label="Dismiss" onClick={onClose}><X size={18} /></button></header>
    {step !== 'create' && <button className="create-back" onClick={() => { setStep(step === 'review' ? 'repos' : 'create'); setNotice(''); }}><ArrowLeft size={15} /> Back</button>}
    {step === 'create' && <><input autoFocus role="combobox" aria-expanded="true" aria-controls="create-options" aria-label="What would you like to create?" placeholder="What would you like to create?" value={query} onChange={e => setQuery(e.target.value)} /><div id="create-options" className="create-options">{options.filter(o => o.toLowerCase().includes(query.toLowerCase())).map(option => option === 'GitHub Repository'
        ? <button key={option} onClick={() => { setStep('repos'); setQuery(''); }}><FolderGit2 size={17} />{option}</button>
        : <button key={option} disabled><Plus size={17} />{option}<span className="create-soon">Coming soon</span></button>)}</div></>}
    {step === 'repos' && <>
      <div className="create-search"><Search size={17} /><input autoFocus aria-label="Search repositories, or paste a URL…" placeholder="Search repositories, or paste a URL…" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="create-repo-actions">
        <button onClick={goInstall}>Configure GitHub App</button>
        {installations !== null && installations.length > 1 && <select aria-label="GitHub account" value={installationId ?? ''} onChange={e => setInstallationId(e.target.value ? Number(e.target.value) : undefined)}><option value="">All accounts</option>{installations.map(i => <option key={i.installationId} value={i.installationId}>{i.accountLogin}</option>)}</select>}
        <button onClick={() => setRefresh(n => n + 1)}>Refresh repos</button>
      </div>
      {isUrl
        ? urlCheck.status === 'valid' && urlCheck.repo
          ? <div className="create-options"><button onClick={() => select(urlCheck.repo!)}><FolderGit2 size={17} />{urlCheck.repo.fullName}{urlCheck.repo.isPrivate && <Lock size={13} />}</button></div>
          : urlCheck.status === 'invalid'
            ? <div className="create-empty"><h3>We couldn’t find this repository</h3><p>It may be private, or the URL may have a typo.</p><p>Only repositories the LikeLion GitHub App can access are listed.</p><button className="btn btn-secondary" onClick={goInstall}>Grant LikeLion access</button></div>
            : <div className="create-empty" role="status"><h3>Validating repository</h3><p>We’re checking that the provided URL is a valid GitHub repository.</p></div>
        : noInstallation
          ? <div className="create-empty"><h3>Install the GitHub App</h3><p>LikeLion needs access to your repositories before it can deploy them.</p><button className="btn btn-secondary" onClick={goInstall}>Install GitHub App</button></div>
          : repos.status === 'error'
            ? <div className="create-empty" role="alert"><h3>Couldn’t load repositories</h3><p>{repos.error}</p></div>
            : repos.status === 'loading' && repos.items.length === 0
              ? <div className="create-empty" role="status"><p>Loading repositories…</p></div>
              : <div className="create-options">{repos.items.map(r => <button key={r.fullName} onClick={() => select(r)}><FolderGit2 size={17} />{r.fullName}{r.isPrivate && <Lock size={13} />}</button>)}{repos.items.length === 0 && <p className="create-empty">No repositories found. Try another search.</p>}</div>}
    </>}
    {step === 'review' && repo && <form onSubmit={e => { e.preventDefault(); void deploy(); }} className="create-review">
      <div className="create-source"><FolderGit2 size={18} />{repo.fullName}</div>
      {!projectId && <label>Project name<input required maxLength={100} value={projectName} onChange={e => setProjectName(e.target.value)} /></label>}
      <label>Service name<input required maxLength={63} pattern={SERVICE_NAME_PATTERN} title="Lowercase letters, digits and hyphens" value={serviceName} onChange={e => setServiceName(e.target.value)} /></label>
      <div className="create-fields">
        <label>Branch<select required value={branch} onChange={e => setBranch(e.target.value)}>{branchOptions.map(b => <option key={b}>{b}</option>)}</select></label>
        <label>Root directory<input value={root} onChange={e => setRoot(e.target.value)} /></label>
      </div>
      {targets.length > 0 && <fieldset className="create-checks"><legend>Deploy to</legend>{targets.map(t => { const supported = isTargetSupported(t); return <label key={t.id} className={supported ? undefined : 'create-unsupported'} title={supported ? undefined : 'Not supported yet'}><input type="checkbox" disabled={!supported} checked={supported && targetIds.includes(t.id)} onChange={e => setTargetIds(ids => e.target.checked ? [...ids, t.id] : ids.filter(id => id !== t.id))} />{t.name}{!supported && <span className="create-soon">Not supported yet</span>}</label>; })}</fieldset>}
      <label className="create-check"><input type="checkbox" checked={autoDeploy} onChange={e => setAutoDeploy(e.target.checked)} />Deploy automatically when the branch is pushed</label>
      <button type="submit" className="btn btn-primary" disabled={submitting || !serviceName.trim() || !branch.trim() || (!projectId && !projectName.trim()) || (targets.length > 0 && targetIds.length === 0)}>{submitting ? 'Creating…' : 'Deploy'}</button>
    </form>}
    {notice && <p className="create-notice" role="status">{notice}</p>}
  </Dialog>;
}

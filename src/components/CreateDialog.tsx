import { useEffect, useState } from 'react';
import { ArrowLeft, FolderGit2, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createDemoDeployment, demoRepositories } from '../data/mock';
import { Dialog } from './ui';
import './CreateDialog.css';

const options = ['GitHub Repository', 'Database', 'Template', 'Docker Image', 'Function', 'Bucket', 'Volume', 'Empty Service'];
export function CreateDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'create' | 'repos' | 'review'>('create');
  const [query, setQuery] = useState('');
  const [repo, setRepo] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('main');
  const [region, setRegion] = useState('US West');
  const [root, setRoot] = useState('/');
  const [variables, setVariables] = useState('');
  const [notice, setNotice] = useState('');
  const [validation, setValidation] = useState<'idle' | 'validating' | 'invalid' | 'valid'>('idle');
  const [urlRepo, setUrlRepo] = useState('');
  useEffect(() => { if (open) { setStep('create'); setQuery(''); setNotice(''); setBranch('main'); setRoot('/'); setVariables(''); } }, [open]);
  useEffect(() => {
    if (!/^(https?:\/\/|github\.com\/)/i.test(query.trim())) { setValidation('idle'); return; }
    setValidation('validating');
    const timer = window.setTimeout(() => {
      const match = query.trim().match(/^(?:https?:\/\/)?github\.com\/([^/\s]+\/[^/\s?#]+)\/?$/i);
      const candidate = match?.[1].replace(/\.git$/, '') || '';
      setUrlRepo(candidate);
      setValidation(demoRepositories.includes(candidate) ? 'valid' : 'invalid');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);
  const select = (value: string) => { setRepo(value); setName(value.split('/')[1]); setStep('review'); setNotice(''); };
  const deploy = () => {
    if (!name.trim() || !branch.trim()) return;
    const created = createDemoDeployment({ repo, name: name.trim(), branch: branch.trim(), region, root, variables, projectId });
    onClose();
    navigate(`/project/${created.project.id}/service/${created.service.id}`);
  };
  return <Dialog open={open} onClose={onClose} className="create-dialog" label="Create">
    <header><h2>{step === 'review' ? 'Review deployment' : 'Create'}</h2><button className="create-icon" aria-label="Dismiss" onClick={onClose}><X size={18} /></button></header>
    {step !== 'create' && <button className="create-back" onClick={() => { setStep(step === 'review' ? 'repos' : 'create'); setNotice(''); }}><ArrowLeft size={15} /> Back</button>}
    {step === 'create' && <><input autoFocus role="combobox" aria-expanded="true" aria-controls="create-options" aria-label="What would you like to create?" placeholder="What would you like to create?" value={query} onChange={e => setQuery(e.target.value)} /><div id="create-options" className="create-options">{options.filter(o => o.toLowerCase().includes(query.toLowerCase())).map(option => <button key={option} onClick={() => { if (option === 'GitHub Repository') { setStep('repos'); setQuery(''); } else setNotice(`${option} creation is not available in this demo. Choose GitHub Repository to simulate a deployment.`); }}>{option === 'GitHub Repository' ? <FolderGit2 size={17} /> : <Plus size={17} />}{option}</button>)}</div></>}
    {step === 'repos' && <><div className="create-search"><Search size={17} /><input autoFocus aria-label="Search repositories, or paste a URL…" placeholder="Search repositories, or paste a URL…" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="create-repo-actions"><button onClick={() => setNotice('Demo GitHub access only. No GitHub App configuration is changed.')}>Configure GitHub App</button><button onClick={() => setNotice('Demo repository list refreshed locally.')}>Refresh repos</button></div>
      {validation === 'validating' ? <div className="create-empty" role="status"><h3>Validating repository</h3><p>We’re checking that the provided URL is a valid GitHub repository.</p><small>Local demo validation only</small></div> : validation === 'invalid' ? <div className="create-empty"><h3>We couldn’t find this repository</h3><p>It may be private, or the URL may have a typo.</p><p>This demo only recognizes the listed sample repositories.</p><button className="btn btn-secondary" onClick={() => setNotice('Demo only: granting Railway access requires the real GitHub App. No permissions changed.')}>Grant Railway access</button></div> : <div className="create-options">{(validation === 'valid' ? [urlRepo] : demoRepositories.filter(r => r.toLowerCase().includes(query.toLowerCase()))).map(r => <button key={r} onClick={() => select(r)}><FolderGit2 size={17} />{r}</button>)}{validation === 'idle' && !demoRepositories.some(r => r.toLowerCase().includes(query.toLowerCase())) && <p className="create-empty">No repositories found. Try another search.</p>}</div>}</>}
    {step === 'review' && <form onSubmit={e => { e.preventDefault(); deploy(); }} className="create-review"><div className="create-source"><FolderGit2 size={18} />{repo}</div><label>{projectId ? 'Service name' : 'Project / service name'}<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label><div className="create-fields"><label>Branch<input required value={branch} onChange={e => setBranch(e.target.value)} /></label><label>Region<select value={region} onChange={e => setRegion(e.target.value)}><option>US West</option><option>US East</option><option>Europe West</option><option>Asia Southeast</option></select></label></div><label>Root directory<input value={root} onChange={e => setRoot(e.target.value)} /></label><label>Variables (KEY=value, one per line)<textarea value={variables} onChange={e => setVariables(e.target.value)} placeholder="NODE_ENV=production" /></label><div className="create-demo"><strong>Demo deployment</strong><p>This creates a local simulated service and logs, saved in this browser. No GitHub fetch, network deployment, billing, or external success.</p></div><button type="submit" className="btn btn-primary" disabled={!name.trim() || !branch.trim()}>Deploy demo</button></form>}
    {notice && <p className="create-notice" role="status">{notice}</p>}
  </Dialog>;
}

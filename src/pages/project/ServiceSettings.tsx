import {
  ChevronDown,
  Code,
  LogOut,
  PencilLine,
  RefreshCw,
  ArrowRight,
  CircleCheck,
  Globe,
  Zap,
  ShieldAlert,
  Copy,
  Earth,
  FileCode2,
  Flag,
  Hammer,
  Network,
  Pencil,
  Plus,
  Rocket,
  Scaling,
  Shield,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { RepoIcon } from '../../components/brand';

import { useUI } from '../../components/ui';
import type { Project, Service } from '../../data/mock';
import { useProjects } from '../../data/ProjectsContext';
import { describeError } from '../../lib/api';
import { isTargetSupported, listBranches, type Builder, type ServiceUpdate } from '../../lib/endpoints';

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="st-box">
      <div className="st-switch-row">
        <button type="button" role="switch" aria-checked={checked} aria-label={label} className="st-switch" onClick={() => onChange(!checked)}>
          <span />
        </button>
        <label className="st-switch-label" onClick={() => onChange(!checked)}>
          {label}
        </label>
      </div>
    </div>
  );
}

/** 누르는 즉시 화면에 반영하고 저장은 뒤에서 한다. 저장이 실패하면 원래 값으로 되돌린다. */
function SavedToggle({ value, label, onSave }: { value: boolean; label: string; onSave: (value: boolean) => Promise<boolean> }) {
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  return (
    <Toggle
      checked={shown}
      label={label}
      onChange={async (next) => {
        setShown(next);
        if (!(await onSave(next))) setShown(value);
      }}
    />
  );
}

function Item({ title, desc, children, id }: { title: string; desc?: ReactNode; children?: ReactNode; id: string }) {
  return (
    <div className="st-item" id={id}>
      <header className="st-item-head">
        <a href={`#${id}`} className="st-item-title" onClick={(e) => e.preventDefault()}>
          {title}
        </a>
        {desc && <h2 className="st-item-desc">{desc}</h2>}
      </header>
      {children && <div className="st-item-body">{children}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <section className="st-section" id={`set-${title}`}>
      {Icon && (
        <div className="st-section-icon">
          <Icon size={18} />
        </div>
      )}
      <h1 className="st-section-title">{title}</h1>
      <div className="st-section-body">{children}</div>
    </section>
  );
}

/** 한 줄 값을 고쳐 저장하는 설정. 비우고 저장하면 null(값 지우기)을 넘긴다. onSave 는 저장에 성공했는지 돌려준다. */
function ValueSetting({ label, value, placeholder, inputProps, onSave }: { label: string; value: string; placeholder?: string; inputProps?: InputHTMLAttributes<HTMLInputElement>; onSave: (value: string | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value), [value]);
  return (
    <form
      className="st-watch"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(draft.trim() === '' ? null : draft.trim());
        setBusy(false);
      }}
    >
      <input aria-label={label} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} {...inputProps} />
      <button type="submit" className="btn btn-outline" disabled={busy || draft.trim() === value}>
        Save
      </button>
    </form>
  );
}

const SECTIONS = ['Source', 'Networking', 'Edge', 'Scale', 'Build', 'Deploy', 'Config-as-code', 'Feature-flags', 'Danger'];

/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */

export function ServiceSettings({ project, service }: { project: Project; service: Service }) {
  const { toast } = useUI();
  const { targets, updateService, removeService } = useProjects();
  const navigate = useNavigate();
  const remote = service.remote;
  const [branches, setBranches] = useState<string[]>([]);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const save = async (changes: ServiceUpdate, message = 'Saved') => {
    try {
      await updateService(project.id, service.id, changes);
      toast(message);
      return true;
    } catch (e) {
      toast(describeError(e));
      return false;
    }
  };
  const remove = async () => {
    setDeleting(true);
    try {
      await removeService(project.id, service.id);
      toast('Service deleted');
      navigate(`/project/${project.id}`, { replace: true });
    } catch (e) {
      toast(describeError(e));
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listBranches(service.repo).then(
      (list) => { if (!cancelled) setBranches(list.map((b) => b.name)); },
      () => { if (!cancelled) setBranches([]); },
    );
    return () => { cancelled = true; };
  }, [service.repo]);
  const [filter, setFilter] = useState('');
  const [ipv6, setIpv6] = useState(false);
  const [cdn, setCdn] = useState(false);
  const [teardown, setTeardown] = useState(false);
  const [serverless, setServerless] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [replicas, setReplicas] = useState('1');
  const [retries, setRetries] = useState('10');
  const [paths, setPaths] = useState<string[]>([]);
  const [pathDraft, setPathDraft] = useState('');
  const [active, setActive] = useState('Source');
  const filterRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = filter.trim().toLowerCase();
  const show = (...words: string[]) => !q || words.some((w) => w.toLowerCase().includes(q));

  // "/" focuses the filter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        filterRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // highlight the section currently in view
  useEffect(() => {
    const scroller = rootRef.current?.closest('.pane-content');
    if (!scroller) return;
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top + 90;
      let current = SECTIONS[0];
      for (const s of SECTIONS) {
        const el = document.getElementById(`set-${s}`);
        if (el && el.getBoundingClientRect().top <= top) current = s;
      }
      setActive(current);
    };
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const jump = (s: string) => {
    setActive(s);
    document.getElementById(`set-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="st" ref={rootRef}>
      <div className="st-filter-bar">
        <div className="st-filter">
          <label htmlFor="set-filter" className="sr-only">
            Filter settings
          </label>
          <input id="set-filter" ref={filterRef} placeholder="Filter Settings..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          {!filter && (
            <button type="button" className="st-filter-kbd" onClick={() => filterRef.current?.focus()}>
              /
            </button>
          )}
        </div>
      </div>

      <div className="st-layout">
        <div className="st-main">
          {show('source', 'repo', 'branch', 'root directory', 'upstream') && (
            <Section title="Source" icon={Code}>
              {remote && (
                <Item title="Service Name" desc="Lowercase letters, digits and hyphens. It becomes part of the service's domain." id="service-name">
                  <ValueSetting
                    label="Service name"
                    value={remote.name}
                    inputProps={{ required: true, maxLength: 63, pattern: '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?', title: 'Lowercase letters, digits and hyphens' }}
                    onSave={(v) => (v ? save({ name: v }) : Promise.resolve(false))}
                  />
                </Item>
              )}
              <Item title="Source Repo" id="source-repo">
                <div className="st-repo error">
                  <a href={`https://github.com/${service.repo}`} target="_blank" rel="noreferrer" className="st-repo-link tall">
                    <RepoIcon size={20} />
                    <p>
                      <span>{service.repo}</span>
                    </p>
                  </a>
                  <div className="st-repo-actions">
                    <button type="button" className="st-icon-btn" aria-label="Edit" onClick={() => toast('Repository picker is mocked')}>
                      <PencilLine size={16} />
                    </button>
                    <button type="button" className="st-mini-btn" onClick={() => toast('Disconnecting is disabled')}>
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
                {remote && (
                  <div className="st-gap12">
                    <p className="st-muted">Root directory (used for build and deploy steps)</p>
                    <ValueSetting label="Root directory" value={remote.rootDirectory ?? ''} placeholder="Repository root" onSave={(v) => save({ rootDirectory: v })} />
                  </div>
                )}
              </Item>
              <Item title="Upstream Repo" id="upstream">
                <div className="st-repo">
                  <a href={`https://github.com/${service.repo}`} target="_blank" rel="noreferrer" className="st-repo-link">
                    <RepoIcon size={20} />
                    <p>
                      <span>{service.repo}</span>
                    </p>
                  </a>
                  <div className="st-repo-actions">
                    <button type="button" className="st-mini-btn red" onClick={() => toast('Eject is mocked')}>
                      <LogOut size={14} />
                      <span>Eject</span>
                    </button>
                  </div>
                </div>
                <div className="st-check">
                  <button type="button" className="st-mini-btn purple" onClick={() => toast("You're on the latest version of this repo")}>
                    <RefreshCw size={14} />
                    <span>Check for updates</span>
                  </button>
                </div>
              </Item>
              <Item title="Branch connected to production" desc="New commits on this GitHub branch are pulled and deployed." id="branch">
                {remote && (
                  <>
                    <div className="st-watch">
                      <select aria-label="Branch" value={remote.sourceBranch} onChange={(e) => void save({ sourceBranch: e.target.value })}>
                        {(branches.includes(remote.sourceBranch) ? branches : [remote.sourceBranch, ...branches]).map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <SavedToggle value={remote.isAutoDeploy} onSave={(v) => save({ isAutoDeploy: v })} label="Auto deploy on push" />
                  </>
                )}
              </Item>
            </Section>
          )}

          {show('networking', 'domain', 'public', 'private', 'ipv6', 'tcp') && (
            <Section title="Networking" icon={Network}>
              {remote && (
                <Item title="Port" desc="The port your app listens on." id="port">
                  <ValueSetting
                    label="Port"
                    value={remote.port ? String(remote.port) : ''}
                    placeholder="e.g. 8080"
                    inputProps={{ type: 'number', min: 1, max: 65535 }}
                    onSave={(v) => save({ port: v === null ? null : Number(v) })}
                  />
                </Item>
              )}
              <Item title="Public Networking" id="public-networking">
                <h2 className="st-item-desc">Reach this service over HTTP with the domains below.</h2>
                {service.domain ? (
                  <div className="st-card st-domain-card">
                    <div className="st-card-row">
                      <div className="st-card-icon">
                        <Globe size={20} />
                      </div>
                      <div className="st-domain-text">
                        <a href={`https://${service.domain}`} target="_blank" rel="noreferrer">
                          <span>{service.domain}</span>
                          <span className="st-ext">↗</span>
                        </a>
                        <p>
                          <span className="st-port">
                            <ArrowRight size={16} />
                            <span>
                              Port <span className="mono">{service.port}</span>
                            </span>
                          </span>
                        </p>
                      </div>
                      <div className="st-card-actions">
                        <button
                          type="button"
                          className="st-sq-btn"
                          aria-label="Copy"
                          onClick={() => {
                            navigator.clipboard?.writeText(service.domain!);
                            toast('Domain copied');
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button type="button" className="st-sq-btn" aria-label="Edit">
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="st-sq-btn" aria-label="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="st-muted st-gap16">This service is not exposed to the internet yet.</p>
                )}
                <div className="st-btn-row">
                  <button type="button" className="btn btn-purple-outline st-plus-btn" onClick={() => toast('Domain generation is mocked')}>
                    <Zap size={16} className="btn-icon" />
                    <span>Generate Domain</span>
                  </button>
                  <button type="button" className="btn btn-purple-outline st-plus-btn">
                    <Plus size={16} className="btn-icon" />
                    <span>Custom Domain</span>
                  </button>
                  <button type="button" className="btn btn-purple-outline st-plus-btn">
                    <Plus size={16} className="btn-icon" />
                    <span>TCP Proxy</span>
                  </button>
                </div>
              </Item>
              <Item title="Private Networking" desc="Other services in this project can reach it internally." id="private-networking">
                <div className="st-card">
                  <div className="st-card-row private">
                    <div className="st-card-icon green">
                      <CircleCheck size={20} />
                    </div>
                    <div className="st-private-text">
                      <div className="st-private-top">
                        <div className="st-private-name">
                          <span>{service.name.toLowerCase()}.likelion.internal</span>
                          <div className="st-ip-tag">
                            <Globe size={12} />
                            IPv4 &amp; IPv6
                          </div>
                        </div>
                        <div className="st-private-actions">
                          <button type="button" className="st-xs-btn" aria-label="Copy" onClick={() => toast('Private domain copied')}>
                            <Copy size={10} />
                          </button>
                          <button type="button" className="st-xs-btn" aria-label="Edit">
                            <Pencil size={10} />
                          </button>
                        </div>
                      </div>
                      <p className="st-private-sub">
                        Ready for private traffic · <span className="st-purple">Short name</span> <code className="st-code-chip">{service.name}</code>
                      </p>
                    </div>
                  </div>
                </div>
              </Item>
              <Item title="Outbound IPv6" desc="Allow this service to open connections to IPv6 hosts." id="ipv6">
                <Toggle checked={ipv6} onChange={setIpv6} label="Enable Outbound IPv6" />
              </Item>
            </Section>
          )}

          {show('edge', 'cdn', 'attack', 'rules') && (
            <Section title="Edge" icon={Shield}>
              <Item title="Under Attack Mode" desc="Adds a browser challenge in front of your domains while traffic looks hostile. Real visitors pass it once and keep browsing." id="attack">
                <div className="st-attack">
                  <div className="st-attack-row">
                    <button type="button" className="st-select">
                      <span>Until turned off</span>
                      <ChevronDown size={16} className="st-region-chev" />
                    </button>
                    <button type="button" className="btn st-activate" onClick={() => toast('Under Attack Mode activated (mock)')}>
                      <ShieldAlert size={20} />
                      <span>Activate</span>
                    </button>
                  </div>
                  <p className="st-muted">Rolls out globally in about 20 seconds.</p>
                </div>
              </Item>
              <Item title="CDN Caching" desc="Serve static assets from the edge to cut latency and origin load." id="cdn">
                <Toggle checked={cdn} onChange={setCdn} label="Enable CDN Caching" />
              </Item>
            </Section>
          )}

          {show('scale', 'region', 'replica', 'cpu', 'memory') && (
            <Section title="Scale" icon={Scaling}>
              <Item title="Targets & Replicas" desc="Choose where this service is deployed." id="regions">
                <div className="st-region-row">
                  <div className="st-checks" role="group" aria-label="Deploy targets">
                    <Earth size={16} />
                    {targets.map((t) => {
                      const supported = isTargetSupported(t);
                      const checked = remote?.targetIds.includes(t.id) ?? false;
                      return (
                        <label key={t.id} className={supported ? undefined : 'st-unsupported'} title={supported ? undefined : 'Not supported yet'}>
                          <input
                            type="checkbox"
                            checked={checked}
                            // 지원하지 않는 타깃은 새로 고를 수 없다. 이미 들어 있으면 뺄 수는 있다.
                            disabled={!supported && !checked}
                            onChange={(e) => {
                              const current = remote?.targetIds ?? [];
                              const next = e.target.checked ? [...current, t.id] : current.filter((id) => id !== t.id);
                              const hasSupported = next.some((id) => {
                                const target = targets.find((x) => x.id === id);
                                return target ? isTargetSupported(target) : false;
                              });
                              if (!hasSupported) toast('At least one supported target is required');
                              else void save({ targetIds: next });
                            }}
                          />
                          {t.name}
                          {!supported && <span className="st-note">Not supported yet</span>}
                        </label>
                      );
                    })}
                  </div>
                  <label className="st-replicas">
                    <input aria-label="Replicas" placeholder="1" value={replicas} onChange={(e) => setReplicas(e.target.value.replace(/\D/g, '').slice(0, 2))} />
                    <span>Replica</span>
                  </label>
                </div>
              </Item>
              <Item title="Replica Limits" desc="Maximum vCPU and memory for each replica." id="limits">
                <div className="st-limits">
                  {[
                    ['CPU', '2', 'vCPU'],
                    ['Memory', '1', 'GB'],
                  ].map(([name, v, unit], i) => (
                    <div key={name}>
                      {i > 0 && <hr className="st-limit-hr" />}
                      <div className="st-limit">
                        <div className="st-limit-head">
                          <span>
                            {name}: <b>{v}</b> {unit}
                          </span>
                        </div>
                        <div className="st-slider">
                          <div />
                          <span />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Item>
            </Section>
          )}

          {show('build', 'builder', 'watch', 'command', 'lionpack') && (
            <Section title="Build" icon={Hammer}>
              <Item title="Builder" id="builder">
                {remote && (
                  <>
                    <div className="st-watch">
                      <select aria-label="Builder" value={remote.builder ?? ''} onChange={(e) => void save({ builder: (e.target.value || null) as Builder | null })}>
                        <option value="">Auto-detect</option>
                        <option value="railpack">Railpack</option>
                        <option value="dockerfile">Dockerfile</option>
                      </select>
                    </div>
                    {remote.builder === 'dockerfile' && (
                      <ValueSetting label="Dockerfile path" value={remote.dockerfilePath ?? ''} placeholder="Dockerfile" onSave={(v) => save({ dockerfilePath: v })} />
                    )}
                  </>
                )}
              </Item>
              <Item title="Custom Build Command" desc="Override the command used to build your app." id="build-cmd">
                {remote && <ValueSetting label="Build command" value={remote.buildCommand ?? ''} placeholder="e.g. npm run build" onSave={(v) => save({ buildCommand: v })} />}
              </Item>
              <Item title="Watch Paths" desc="Gitignore-style patterns; only matching changes trigger a deploy." id="watch">
                <div className="st-watch">
                  <input
                    aria-label="Add pattern"
                    placeholder="Add pattern e.g. /src/**"
                    value={pathDraft}
                    onChange={(e) => setPathDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pathDraft.trim()) {
                        setPaths((p) => [...p, pathDraft.trim()]);
                        setPathDraft('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!pathDraft.trim()}
                    onClick={() => {
                      setPaths((p) => [...p, pathDraft.trim()]);
                      setPathDraft('');
                    }}
                  >
                    Add
                  </button>
                </div>
                {paths.map((p) => (
                  <div key={p} className="st-chip mono">
                    {p}
                    <button type="button" aria-label="Remove" onClick={() => setPaths((all) => all.filter((x) => x !== p))}>
                      ×
                    </button>
                  </div>
                ))}
              </Item>
            </Section>
          )}

          {show('deploy', 'start', 'teardown', 'cron', 'healthcheck', 'serverless', 'restart') && (
            <Section title="Deploy" icon={Rocket}>
              <Item title="Custom Start Command" desc="Command used to boot new deployments." id="start-cmd">
                {remote && <ValueSetting label="Start command" value={remote.startCommand ?? ''} placeholder="e.g. npm start" onSave={(v) => save({ startCommand: v })} />}
                <p className="st-muted">Add pre-deploy step</p>
              </Item>
              <Item title="Teardown" desc="How the previous deployment is stopped when a new one goes live." id="teardown">
                <Toggle checked={teardown} onChange={setTeardown} label="Enable Teardown" />
              </Item>
              <Item title="Cron Schedule" desc="Run this service on a cron schedule." id="cron">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> Add Schedule
                  </button>
                </div>
              </Item>
              <Item title="Healthcheck Path" desc="Endpoint polled before a deploy is marked live." id="healthcheck">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> Healthcheck Path
                  </button>
                </div>
              </Item>
              <Item title="Serverless" desc="Scale to zero when idle; queued requests wake the container." id="serverless">
                <Toggle checked={serverless} onChange={setServerless} label="Enable Serverless" />
              </Item>
              <Item title="Restart Policy" desc="What to do when the process exits." id="restart">
                <button type="button" className="st-box st-policy">
                  <div>
                    <b>On Failure</b>
                    <p className="st-muted">Restart when the process exits with a non-zero code.</p>
                  </div>
                  <ChevronDown size={16} className="st-region-chev" />
                </button>
                <label className="st-retries">
                  <span>Max restart retries</span>
                  <input value={retries} onChange={(e) => setRetries(e.target.value.replace(/\D/g, '').slice(0, 2))} />
                </label>
              </Item>
            </Section>
          )}

          {show('config', 'file', 'code') && (
            <Section title="Config-as-code" icon={FileCode2}>
              <Item title="LikeLion Config File" desc="Deprecated in favor of Infrastructure as Code; existing files keep working for now." id="config-file">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> Add File Path
                  </button>
                </div>
              </Item>
            </Section>
          )}

          {show('feature', 'flags', 'skipped') && (
            <Section title="Feature-flags" icon={Flag}>
              <div className="st-item">
                <Toggle checked={skipped} onChange={setSkipped} label="Skipped Builds" />
                <p className="st-muted">Reuse an earlier build when the source code has not changed. GitHub only.</p>
              </div>
            </Section>
          )}

          {show('danger', 'delete') && (
            <section className="st-section danger" id="set-Danger">
              <Item title="Delete Service" desc="Removes this service from the project." id="delete">
                <div className="st-delete-box">
                  <label className="st-muted" htmlFor="delete-confirm">
                    Type <b>{service.name}</b> to confirm
                  </label>
                  <input id="delete-confirm" className="st-delete-input" value={deleteName} onChange={(e) => setDeleteName(e.target.value)} />
                  <button type="button" className="btn st-delete" disabled={deleteName !== service.name || deleting} onClick={() => void remove()}>
                    <TriangleAlert size={16} /> Delete service
                  </button>
                </div>
              </Item>
            </section>
          )}
        </div>

        <aside className="st-toc">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s} aria-label={s}>
                <a
                  href={`#set-${s}`}
                  className={active === s ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s);
                  }}
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

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
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { RepoIcon } from '../../components/brand';

import { ConfirmDialog, useUI } from '../../components/ui';
import { DEPLOYMENT_STRATEGIES, MIN_REPLICAS_FOR_PROGRESSIVE, fallsBackToRolling, isRollingOnlyTarget, isStrategyRejected, needsReplicas, strategyDescKey, strategyLabel, strategyOf } from '../../data/deploymentStrategyModel';
import type { Project, Service } from '../../data/mock';
import { useProjects } from '../../data/ProjectsContext';
import { MAX_REPLICAS, MIN_REPLICAS, cpuCores, cpuLabel, memoryLabel, memoryMiB, stopIndex, type Stop } from '../../data/scalingModel';
import { useServiceScaling } from '../../data/useServiceScaling';
import { ApiError, describeError } from '../../lib/api';
import { isTargetSupported, listBranches, type Builder, type DeploymentStrategy, type ServiceUpdate } from '../../lib/endpoints';
import { useI18n, type MessageKey } from '../../i18n';

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

function Section({ name, icon: Icon, children }: { name: string; icon?: LucideIcon; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="st-section" id={`set-${name}`}>
      {Icon && (
        <div className="st-section-icon">
          <Icon size={18} />
        </div>
      )}
      <h1 className="st-section-title">{t(SECTION_LABEL[name])}</h1>
      <div className="st-section-body">{children}</div>
    </section>
  );
}

/** 한 줄 값을 고쳐 저장하는 설정. 비우고 저장하면 null(값 지우기)을 넘긴다. onSave 는 저장에 성공했는지 돌려준다. */
function ValueSetting({ label, value, placeholder, inputProps, onSave }: { label: string; value: string; placeholder?: string; inputProps?: InputHTMLAttributes<HTMLInputElement>; onSave: (value: string | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
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
        {t('svcSettings.save')}
      </button>
    </form>
  );
}

/** 정해진 칸 중 하나를 고르는 슬라이더. 고른 칸의 값을 머리에 보여준다. 값이 없으면(아직 못 받았으면) 고를 수 없다. */
function LimitSlider({ name, ready, stops, value, parse, format, disabled, onChange }: { name: string; ready: boolean; stops: Stop[]; value: string; parse: (qty: string) => number; format: (amount: number) => { value: string; unit: string }; disabled: boolean; onChange: (qty: string) => void }) {
  const index = stopIndex(stops, value, parse);
  const ratio = stops.length > 1 ? index / (stops.length - 1) : 1;
  const label = ready ? format(stops[index].amount) : null;
  const text = label ? `${label.value} ${label.unit}` : 'loading';
  return (
    <div className="st-limit">
      <div className="st-limit-head">
        <span>
          {name}: <b>{label?.value ?? '–'}</b> {label?.unit}
        </span>
      </div>
      <input
        type="range"
        className="st-range"
        aria-label={`${name} limit`}
        aria-valuetext={text}
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        style={{ '--ratio': ratio } as CSSProperties}
        onChange={(e) => onChange(stops[Number(e.target.value)].qty)}
      />
    </div>
  );
}

/**
 * 배포 방식을 고르는 즉시 저장한다. 저장하는 동안은 다시 고를 수 없고, 저장에 실패하면 저장된 값으로 되돌린다.
 * 카나리·블루그린은 **저장된** 레플리카(savedReplicas)가 2개 이상일 때만 고를 수 있다. 아직 모르면(불러오는 중·실패) 고를 수 없다.
 * 온프레미스 타깃(rollingOnly)은 레플리카와 상관없이 롤링만 고를 수 있다.
 */
function StrategyPicker({ value, savedReplicas, replicasUnknown, rollingOnly, onSave }: { value: DeploymentStrategy; savedReplicas: number | null; replicasUnknown: boolean; rollingOnly: boolean; onSave: (strategy: DeploymentStrategy) => Promise<boolean> }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setShown(value), [value]);
  const canProgressive = !rollingOnly && savedReplicas !== null && savedReplicas >= MIN_REPLICAS_FOR_PROGRESSIVE;
  const choose = async (next: DeploymentStrategy) => {
    if (busy || next === shown) return;
    setShown(next);
    setBusy(true);
    const saved = await onSave(next);
    setBusy(false);
    if (!saved) setShown(value);
  };
  const label = (strategy: DeploymentStrategy) => strategyLabel(t, strategy);
  const vars = { min: MIN_REPLICAS_FOR_PROGRESSIVE, strategy: label(value) };
  const hint = busy
    ? { text: t('svcSettings.strategy.saving') }
    : rollingOnly
      ? { text: t('svcSettings.strategy.onPremOnly'), warn: needsReplicas(value) }
      : savedReplicas !== null && fallsBackToRolling(value, savedReplicas)
        ? { text: t('svcSettings.strategy.fallback', vars), warn: true }
        : savedReplicas !== null && !canProgressive
          ? { text: t('svcSettings.strategy.needsReplicas', vars) }
          : replicasUnknown
            ? { text: t('svcSettings.strategy.replicasUnknown') }
            : null;
  return (
    <>
      <div className="st-strategies" role="radiogroup" aria-label={t('svcSettings.strategy.title')} aria-busy={busy}>
        {DEPLOYMENT_STRATEGIES.map((strategy) => {
          const locked = needsReplicas(strategy) && !canProgressive;
          return (
            <label key={strategy} className={`st-box st-strategy${shown === strategy ? ' selected' : ''}${locked ? ' locked' : ''}`}>
              <input type="radio" name="deployment-strategy" value={strategy} checked={shown === strategy} disabled={busy || locked} onChange={() => void choose(strategy)} />
              <span>
                <b>{label(strategy)}</b>
                <span className="st-muted">{t(strategyDescKey(strategy))}</span>
              </span>
            </label>
          );
        })}
      </div>
      {hint && <p className={`st-hint${hint.warn ? ' warn' : ''}`}>{hint.text}</p>}
    </>
  );
}

// 키는 섹션 앵커 id(set-<키>)로도 쓰이므로 번역하지 않는다.
const SECTION_LABEL: Record<string, MessageKey> = {
  Source: 'svcSettings.sec.source',
  Networking: 'svcSettings.sec.networking',
  Edge: 'svcSettings.sec.edge',
  Scale: 'svcSettings.sec.scale',
  Build: 'svcSettings.sec.build',
  Deploy: 'svcSettings.sec.deploy',
  'Config-as-code': 'svcSettings.sec.config',
  'Feature-flags': 'svcSettings.sec.flags',
  Danger: 'svcSettings.sec.danger',
};
const SECTIONS = Object.keys(SECTION_LABEL);

/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */

/** onScaled 는 Pod 수·자원 변경이 접수돼 RESTART 배포가 만들어진 뒤 부른다(배포 목록을 바로 다시 받으려는 것). */
export function ServiceSettings({ project, service, onScaled }: { project: Project; service: Service; onScaled?: () => void }) {
  const { toast } = useUI();
  const { t } = useI18n();
  const { targets, updateService, removeService, refreshService } = useProjects();
  const navigate = useNavigate();
  const remote = service.remote;
  const [branches, setBranches] = useState<string[]>([]);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const targetLocked = !!remote?.latestDeployment;
  const save = async (changes: ServiceUpdate, message = t('svcSettings.saved')) => {
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
      toast(t('svcSettings.deleted'));
      navigate(`/project/${project.id}`, { replace: true });
    } catch (e) {
      toast(e instanceof ApiError && e.code === 'DEPLOYMENT_IN_PROGRESS' ? t('svcSettings.delete.inProgress') : describeError(e));
      setDeleting(false);
    }
  };

  const applyScale = async () => {
    setDownscaleWarning(false);
    try {
      await scale.apply();
      toast(t('svcSettings.scale.requested'));
      void refreshService(project.id, service.id).catch(() => undefined);
      onScaled?.();
    } catch (e) {
      toast(describeError(e));
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
  const scale = useServiceScaling(service.id);
  const strategy = strategyOf(remote);
  // 온프레미스 타깃은 롤링만 지원한다. 타깃 목록을 아직 받지 못했으면 서버의 422 가 막는다.
  const rollingOnly = isRollingOnlyTarget(targets.find((target) => target.id === remote?.targetIds[0]));
  const [downscaleWarning, setDownscaleWarning] = useState(false);
  // 저장된 레플리카로는 고른 방식을 쓰다가 이번 적용으로 2개 미만이 되면, 롤링으로 대체된다고 먼저 알린다.
  const requestScale = () => {
    const willFallBack = !rollingOnly && scale.savedReplicas !== null && scale.replicas !== null && !fallsBackToRolling(strategy, scale.savedReplicas) && fallsBackToRolling(strategy, scale.replicas);
    if (willFallBack) setDownscaleWarning(true);
    else void applyScale();
  };
  const saveStrategy = async (next: DeploymentStrategy) => {
    try {
      const updated = await updateService(project.id, service.id, { deploymentStrategy: next });
      // 배포 방식을 모르는 서버(구버전)는 키를 무시하고 저장하지 않는다.
      if (strategyOf(updated.remote) !== next) {
        toast(t('svcSettings.strategy.unavailable'));
        return false;
      }
      toast(t('svcSettings.strategy.saved'));
      return true;
    } catch (e) {
      if (!isStrategyRejected(e)) toast(describeError(e));
      else if (rollingOnly) toast(t('svcSettings.strategy.onPremOnly'));
      else if (scale.savedReplicas !== null && scale.savedReplicas < MIN_REPLICAS_FOR_PROGRESSIVE) toast(t('svcSettings.strategy.needsReplicas', { min: MIN_REPLICAS_FOR_PROGRESSIVE }));
      else toast(t('svcSettings.strategy.unavailable'));
      return false;
    }
  };
  const [retries, setRetries] = useState('10');
  const [paths, setPaths] = useState<string[]>([]);
  const [pathDraft, setPathDraft] = useState('');
  const [active, setActive] = useState('Source');
  const filterRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = filter.trim().toLowerCase();
  // 섹션 이름은 현재 언어로도 검색되게 한다.
  const show = (section: string, ...words: string[]) => !q || [t(SECTION_LABEL[section]), section, ...words].some((w) => w.toLowerCase().includes(q));

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
            {t('svcSettings.filterLabel')}
          </label>
          <input id="set-filter" ref={filterRef} placeholder={t('svcSettings.filterPlaceholder')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          {!filter && (
            <button type="button" className="st-filter-kbd" onClick={() => filterRef.current?.focus()}>
              /
            </button>
          )}
        </div>
      </div>

      <div className="st-layout">
        <div className="st-main">
          {show('Source', 'repo', 'branch', 'root directory', 'upstream') && (
            <Section name="Source" icon={Code}>
              {remote && (
                <Item title={t('svcSettings.serviceName.title')} desc={t('svcSettings.serviceName.desc')} id="service-name">
                  <ValueSetting
                    label={t('svcSettings.serviceName.label')}
                    value={remote.name}
                    inputProps={{ required: true, maxLength: 63, pattern: '[a-z0-9]([a-z0-9\\-]{0,61}[a-z0-9])?', title: t('svcSettings.serviceName.hint') }}
                    onSave={(v) => (v ? save({ name: v }) : Promise.resolve(false))}
                  />
                </Item>
              )}
              <Item title={t('svcSettings.sourceRepo')} id="source-repo">
                <div className="st-repo error">
                  <a href={`https://github.com/${service.repo}`} target="_blank" rel="noreferrer" className="st-repo-link tall">
                    <RepoIcon size={20} />
                    <p>
                      <span>{service.repo}</span>
                    </p>
                  </a>
                  <div className="st-repo-actions">
                    <button type="button" className="st-icon-btn" aria-label={t('svcSettings.edit')} onClick={() => toast(t('svcSettings.repoPickerMock'))}>
                      <PencilLine size={16} />
                    </button>
                    <button type="button" className="st-mini-btn" onClick={() => toast(t('svcSettings.disconnectDisabled'))}>
                      <span>{t('svcSettings.disconnect')}</span>
                    </button>
                  </div>
                </div>
                {remote && (
                  <div className="st-gap12">
                    <p className="st-muted">{t('svcSettings.rootDir.desc')}</p>
                    <ValueSetting label={t('svcSettings.rootDir.label')} value={remote.rootDirectory ?? ''} placeholder={t('svcSettings.rootDir.placeholder')} onSave={(v) => save({ rootDirectory: v })} />
                  </div>
                )}
              </Item>
              <Item title={t('svcSettings.upstream')} id="upstream">
                <div className="st-repo">
                  <a href={`https://github.com/${service.repo}`} target="_blank" rel="noreferrer" className="st-repo-link">
                    <RepoIcon size={20} />
                    <p>
                      <span>{service.repo}</span>
                    </p>
                  </a>
                  <div className="st-repo-actions">
                    <button type="button" className="st-mini-btn red" onClick={() => toast(t('svcSettings.ejectMock'))}>
                      <LogOut size={14} />
                      <span>{t('svcSettings.eject')}</span>
                    </button>
                  </div>
                </div>
                <div className="st-check">
                  <button type="button" className="st-mini-btn primary" onClick={() => toast(t('svcSettings.latest'))}>
                    <RefreshCw size={14} />
                    <span>{t('svcSettings.checkUpdates')}</span>
                  </button>
                </div>
              </Item>
              <Item title={t('svcSettings.branch.title')} desc={t('svcSettings.branch.desc')} id="branch">
                {remote && (
                  <>
                    <div className="st-watch">
                      <select aria-label={t('svcSettings.branch.label')} value={remote.sourceBranch} onChange={(e) => void save({ sourceBranch: e.target.value })}>
                        {(branches.includes(remote.sourceBranch) ? branches : [remote.sourceBranch, ...branches]).map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <SavedToggle value={remote.isAutoDeploy} onSave={(v) => save({ isAutoDeploy: v })} label={t('svcSettings.autoDeploy')} />
                  </>
                )}
              </Item>
            </Section>
          )}

          {show('Networking', 'domain', 'public', 'private', 'ipv6', 'tcp') && (
            <Section name="Networking" icon={Network}>
              {remote && (
                <Item title={t('svcSettings.port.title')} desc={t('svcSettings.port.desc')} id="port">
                  <ValueSetting
                    label={t('svcSettings.port.title')}
                    value={remote.port ? String(remote.port) : ''}
                    placeholder={t('svcSettings.port.placeholder')}
                    inputProps={{ type: 'number', min: 1, max: 65535 }}
                    onSave={(v) => save({ port: v === null ? null : Number(v) })}
                  />
                </Item>
              )}
              <Item title={t('svcSettings.public.title')} id="public-networking">
                <h2 className="st-item-desc">{t('svcSettings.public.desc')}</h2>
                {service.domains === undefined ? (
                  <p className="st-muted st-gap16">{t('svcSettings.loadingDomains')}</p>
                ) : service.domains.length > 0 ? (
                  service.domains.map((d) => (
                    <div key={d.host} className="st-card st-domain-card">
                      <div className="st-card-row">
                        <div className="st-card-icon">
                          <Globe size={20} />
                        </div>
                        <div className="st-domain-text">
                          <a href={`https://${d.host}`} target="_blank" rel="noreferrer">
                            <span>{d.host}</span>
                            <span className="st-ext">↗</span>
                          </a>
                          <p>
                            {service.port !== undefined && (
                              <span className="st-port">
                                <ArrowRight size={16} />
                                <span>
                                  {t('svcSettings.port.title')} <span className="mono">{service.port}</span>
                                </span>
                              </span>
                            )}
                            <span>
                              {service.port !== undefined && ' · '}
                              {d.targetName}
                              {!d.isConnected && ` · ${t('svcSettings.reachableAfter')}`}
                            </span>
                          </p>
                        </div>
                        <div className="st-card-actions">
                          <button
                            type="button"
                            className="st-sq-btn"
                            aria-label={t('svcSettings.copy')}
                            onClick={() => {
                              navigator.clipboard?.writeText(d.host);
                              toast(t('svcSettings.domainCopied'));
                            }}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="st-muted st-gap16">{t('svcSettings.notExposed')}</p>
                )}
                <div className="st-btn-row">
                  <button type="button" className="btn btn-primary-outline st-plus-btn" onClick={() => toast(t('svcSettings.domainGenMock'))}>
                    <Zap size={16} className="btn-icon" />
                    <span>{t('svcSettings.generateDomain')}</span>
                  </button>
                  <button type="button" className="btn btn-primary-outline st-plus-btn">
                    <Plus size={16} className="btn-icon" />
                    <span>{t('svcSettings.customDomain')}</span>
                  </button>
                  <button type="button" className="btn btn-primary-outline st-plus-btn">
                    <Plus size={16} className="btn-icon" />
                    <span>{t('svcSettings.tcpProxy')}</span>
                  </button>
                </div>
              </Item>
              <Item title={t('svcSettings.private.title')} desc={t('svcSettings.private.desc')} id="private-networking">
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
                          <button type="button" className="st-xs-btn" aria-label={t('svcSettings.copy')} onClick={() => toast(t('svcSettings.privateCopied'))}>
                            <Copy size={10} />
                          </button>
                          <button type="button" className="st-xs-btn" aria-label={t('svcSettings.edit')}>
                            <Pencil size={10} />
                          </button>
                        </div>
                      </div>
                      <p className="st-private-sub">
                        {t('svcSettings.privateReady')} · <span className="st-primary">{t('svcSettings.shortName')}</span> <code className="st-code-chip">{service.name}</code>
                      </p>
                    </div>
                  </div>
                </div>
              </Item>
              <Item title={t('svcSettings.ipv6.title')} desc={t('svcSettings.ipv6.desc')} id="ipv6">
                <Toggle checked={ipv6} onChange={setIpv6} label={t('svcSettings.ipv6.toggle')} />
              </Item>
            </Section>
          )}

          {show('Edge', 'cdn', 'attack', 'rules') && (
            <Section name="Edge" icon={Shield}>
              <Item title={t('svcSettings.attack.title')} desc={t('svcSettings.attack.desc')} id="attack">
                <div className="st-attack">
                  <div className="st-attack-row">
                    <button type="button" className="st-select">
                      <span>{t('svcSettings.attack.until')}</span>
                      <ChevronDown size={16} className="st-region-chev" />
                    </button>
                    <button type="button" className="btn st-activate" onClick={() => toast(t('svcSettings.attack.activated'))}>
                      <ShieldAlert size={20} />
                      <span>{t('svcSettings.attack.activate')}</span>
                    </button>
                  </div>
                  <p className="st-muted">{t('svcSettings.attack.rollout')}</p>
                </div>
              </Item>
              <Item title={t('svcSettings.cdn.title')} desc={t('svcSettings.cdn.desc')} id="cdn">
                <Toggle checked={cdn} onChange={setCdn} label={t('svcSettings.cdn.toggle')} />
              </Item>
            </Section>
          )}

          {show('Scale', 'region', 'replica', 'cpu', 'memory') && (
            <Section name="Scale" icon={Scaling}>
              <Item title={t('svcSettings.regions.title')} desc={t('svcSettings.regions.desc')} id="regions">
                <div className="st-region-row">
                  <div className="st-checks" role="group" aria-label={t('svcSettings.regions.label')}>
                    <Earth size={16} />
                    {targets.map((target) => {
                      const supported = isTargetSupported(target);
                      const checked = remote?.targetIds[0] === target.id;
                      return (
                        <label key={target.id} className={supported ? undefined : 'st-unsupported'} title={supported ? undefined : t('svcSettings.notSupported')}>
                          <input
                            type="radio"
                            name="service-target"
                            checked={checked}
                            // 한 번 배포한 서비스는 타깃을 바꿀 수 없다.
                            disabled={!supported || targetLocked}
                            onChange={() => void save({ targetIds: [target.id] })}
                          />
                          {target.name}
                          {!supported && <span className="st-note">{t('svcSettings.notSupported')}</span>}
                        </label>
                      );
                    })}
                    {targetLocked && <span className="st-note">{t('svcSettings.targetLocked')}</span>}
                  </div>
                  <label className="st-replicas">
                    <input
                      aria-label={t('svcSettings.replicas')}
                      inputMode="numeric"
                      placeholder="1"
                      value={scale.replicasText}
                      disabled={!scale.ready || scale.busy}
                      aria-invalid={scale.ready && !scale.valid}
                      onChange={(e) => scale.setReplicasText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    />
                    <span>{t('svcSettings.replica')}</span>
                  </label>
                </div>
                {scale.ready && !scale.valid && <p className="st-hint error">{t('svcSettings.replicasInvalid', { min: MIN_REPLICAS, max: MAX_REPLICAS })}</p>}
                {scale.replicas === 0 && <p className="st-hint">{t('svcSettings.replicasZero')}</p>}
              </Item>
              <Item title={t('svcSettings.limits.title')} desc={t('svcSettings.limits.desc')} id="limits">
                <div className="st-limits">
                  <LimitSlider
                    name="CPU"
                    ready={scale.ready}
                    stops={scale.cpuStops}
                    value={scale.cpu}
                    parse={cpuCores}
                    format={cpuLabel}
                    disabled={!scale.ready || scale.busy}
                    onChange={scale.setCpu}
                  />
                  <hr className="st-limit-hr" />
                  <LimitSlider
                    name={t('svcSettings.memory')}
                    ready={scale.ready}
                    stops={scale.memoryStops}
                    value={scale.memory}
                    parse={memoryMiB}
                    format={memoryLabel}
                    disabled={!scale.ready || scale.busy}
                    onChange={scale.setMemory}
                  />
                </div>
                <div className="st-apply">
                  <p className={`st-hint${scale.error ? ' error' : ''}`}>
                    {scale.error ?? (scale.loading ? t('svcSettings.scale.loading') : service.removed ? t('svcSettings.scale.removed') : service.deploying ? t('svcSettings.scale.waitDeploy') : t('svcSettings.scale.restartHint'))}
                  </p>
                  {scale.error ? (
                    <button type="button" className="btn btn-outline" onClick={scale.retry}>
                      {t('svcSettings.scale.retry')}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn btn-outline" disabled={!scale.edited || scale.busy} onClick={scale.reset}>
                        {t('svcSettings.scale.reset')}
                      </button>
                      <button type="button" className="btn btn-primary-outline" disabled={!scale.dirty || scale.busy || !!service.deploying || !!service.removed} onClick={requestScale}>
                        {scale.busy ? t('svcSettings.scale.applying') : t('svcSettings.scale.apply')}
                      </button>
                    </>
                  )}
                </div>
              </Item>
              <ConfirmDialog
                open={downscaleWarning}
                title={t('svcSettings.strategy.downscale.title')}
                confirmLabel={t('svcSettings.strategy.downscale.continue')}
                cancelLabel={t('svcSettings.strategy.downscale.cancel')}
                onClose={() => setDownscaleWarning(false)}
                onConfirm={() => void applyScale()}
              >
                {t('svcSettings.strategy.downscale.body', { min: MIN_REPLICAS_FOR_PROGRESSIVE, strategy: strategyLabel(t, strategy) })}
              </ConfirmDialog>
            </Section>
          )}

          {show('Build', 'builder', 'watch', 'command', 'lionpack') && (
            <Section name="Build" icon={Hammer}>
              <Item title={t('svcSettings.builder.title')} id="builder">
                {remote && (
                  <>
                    <div className="st-watch">
                      <select aria-label={t('svcSettings.builder.title')} value={remote.builder ?? ''} onChange={(e) => void save({ builder: (e.target.value || null) as Builder | null })}>
                        <option value="">{t('svcSettings.builder.auto')}</option>
                        <option value="railpack">Railpack</option>
                        <option value="dockerfile">Dockerfile</option>
                      </select>
                    </div>
                    {remote.builder === 'dockerfile' && (
                      <ValueSetting label={t('svcSettings.dockerfilePath')} value={remote.dockerfilePath ?? ''} placeholder="Dockerfile" onSave={(v) => save({ dockerfilePath: v })} />
                    )}
                  </>
                )}
              </Item>
              <Item title={t('svcSettings.buildCmd.title')} desc={t('svcSettings.buildCmd.desc')} id="build-cmd">
                {remote && <ValueSetting label={t('svcSettings.buildCmd.label')} value={remote.buildCommand ?? ''} placeholder={t('svcSettings.buildCmd.placeholder')} onSave={(v) => save({ buildCommand: v })} />}
              </Item>
              <Item title={t('svcSettings.watch.title')} desc={t('svcSettings.watch.desc')} id="watch">
                <div className="st-watch">
                  <input
                    aria-label={t('svcSettings.watch.label')}
                    placeholder={t('svcSettings.watch.placeholder')}
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
                    {t('svcSettings.add')}
                  </button>
                </div>
                {paths.map((p) => (
                  <div key={p} className="st-chip mono">
                    {p}
                    <button type="button" aria-label={t('svcSettings.remove')} onClick={() => setPaths((all) => all.filter((x) => x !== p))}>
                      ×
                    </button>
                  </div>
                ))}
              </Item>
            </Section>
          )}

          {show('Deploy', 'start', 'strategy', 'rolling', 'canary', 'blue-green', 'teardown', 'cron', 'healthcheck', 'serverless', 'restart') && (
            <Section name="Deploy" icon={Rocket}>
              <Item title={t('svcSettings.startCmd.title')} desc={t('svcSettings.startCmd.desc')} id="start-cmd">
                {remote && <ValueSetting label={t('svcSettings.startCmd.label')} value={remote.startCommand ?? ''} placeholder={t('svcSettings.startCmd.placeholder')} onSave={(v) => save({ startCommand: v })} />}
                <p className="st-muted">{t('svcSettings.preDeploy')}</p>
              </Item>
              {remote && (
                <Item title={t('svcSettings.strategy.title')} desc={t('svcSettings.strategy.desc')} id="deployment-strategy">
                  <StrategyPicker value={strategy} savedReplicas={scale.savedReplicas} replicasUnknown={!!scale.error} rollingOnly={rollingOnly} onSave={saveStrategy} />
                </Item>
              )}
              <Item title={t('svcSettings.teardown.title')} desc={t('svcSettings.teardown.desc')} id="teardown">
                <Toggle checked={teardown} onChange={setTeardown} label={t('svcSettings.teardown.toggle')} />
              </Item>
              <Item title={t('svcSettings.cron.title')} desc={t('svcSettings.cron.desc')} id="cron">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> {t('svcSettings.cron.add')}
                  </button>
                </div>
              </Item>
              <Item title={t('svcSettings.health.title')} desc={t('svcSettings.health.desc')} id="healthcheck">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> {t('svcSettings.health.title')}
                  </button>
                </div>
              </Item>
              <Item title={t('svcSettings.serverless.title')} desc={t('svcSettings.serverless.desc')} id="serverless">
                <Toggle checked={serverless} onChange={setServerless} label={t('svcSettings.serverless.toggle')} />
              </Item>
              <Item title={t('svcSettings.restart.title')} desc={t('svcSettings.restart.desc')} id="restart">
                <button type="button" className="st-box st-policy">
                  <div>
                    <b>{t('svcSettings.restart.onFailure')}</b>
                    <p className="st-muted">{t('svcSettings.restart.onFailureDesc')}</p>
                  </div>
                  <ChevronDown size={16} className="st-region-chev" />
                </button>
                <label className="st-retries">
                  <span>{t('svcSettings.restart.retries')}</span>
                  <input value={retries} onChange={(e) => setRetries(e.target.value.replace(/\D/g, '').slice(0, 2))} />
                </label>
              </Item>
            </Section>
          )}

          {show('Config-as-code', 'file') && (
            <Section name="Config-as-code" icon={FileCode2}>
              <Item title={t('svcSettings.configFile.title')} desc={t('svcSettings.configFile.desc')} id="config-file">
                <div>
                  <button type="button" className="btn btn-outline">
                    <Plus size={16} /> {t('svcSettings.configFile.add')}
                  </button>
                </div>
              </Item>
            </Section>
          )}

          {show('Feature-flags', 'skipped') && (
            <Section name="Feature-flags" icon={Flag}>
              <div className="st-item">
                <Toggle checked={skipped} onChange={setSkipped} label={t('svcSettings.skipped.toggle')} />
                <p className="st-muted">{t('svcSettings.skipped.desc')}</p>
              </div>
            </Section>
          )}

          {show('Danger', 'delete') && (
            <section className="st-section danger" id="set-Danger">
              <Item title={t('svcSettings.delete.title')} desc={t('svcSettings.delete.desc')} id="delete">
                <div className="st-delete-box">
                  <label className="st-muted" htmlFor="delete-confirm">
                    {t('svcSettings.delete.confirmBefore')}<b>{service.name}</b>{t('svcSettings.delete.confirmAfter')}
                  </label>
                  <input id="delete-confirm" className="st-delete-input" value={deleteName} onChange={(e) => setDeleteName(e.target.value)} />
                  <button type="button" className="btn st-delete" disabled={deleteName !== service.name || deleting} onClick={() => void remove()}>
                    <TriangleAlert size={16} /> {t('svcSettings.delete.button')}
                  </button>
                </div>
              </Item>
            </section>
          )}
        </div>

        <aside className="st-toc">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s} aria-label={t(SECTION_LABEL[s])}>
                <a
                  href={`#set-${s}`}
                  className={active === s ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(s);
                  }}
                >
                  {t(SECTION_LABEL[s])}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, CircleAlert, Database, KeyRound, Layers, Sparkles, Info, Zap } from 'lucide-react';
import type { AnalysisState } from '../data/useRepositoryAnalysis';
import type * as api from '../lib/endpoints';
import { useI18n, type MessageKey } from '../i18n';
import { Tooltip } from './ui';
import { ENGINE_LABEL } from './DatabaseBits';
import './RepoAnalysisStep.css';

// 서비스 이름 규칙(CreateDialog 와 같다). 도메인에 쓰이므로 DNS 레이블 규칙을 따른다.
export const SERVICE_NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '') || 'service';

/** 화면에서 고치는 unit 하나. 숫자 칸은 입력 중인 문자열 그대로 쥔다. */
export type UnitDraft = {
  unitId: string;
  selected: boolean;
  name: string;
  rootDirectory: string;
  builder: api.Builder;
  dockerfilePath: string;
  port: string;
};

export const toUnitDrafts = (units: api.AnalysisUnitDto[]): UnitDraft[] =>
  units.map((u) => ({
    unitId: u.id,
    selected: true,
    name: slugify(u.name),
    rootDirectory: u.rootDirectory,
    builder: u.builder,
    dockerfilePath: u.dockerfilePath ?? '',
    port: u.port ? String(u.port) : '',
  }));

/** 화면에서 고치는 의존성(DB) 하나. provision 이면 플랫폼이 개발용 DB 서비스를 만든다. */
export type DepDraft = { id: string; engine: api.AnalysisDependencyDto['engine']; provision: boolean; name: string };

/** 지원하는 엔진(postgres·mysql·mongodb·redis)은 기본으로 자동 생성한다. 그 밖(other)은 만들 수 없다. */
export const canProvision = (engine: api.AnalysisDependencyDto['engine']) => engine !== 'other';
export const toDepDrafts = (deps: api.AnalysisDependencyDto[]): DepDraft[] =>
  deps.map((d) => ({ id: d.id, engine: d.engine, provision: canProvision(d.engine), name: slugify(d.id) }));

/** apply 요청의 dependencies. 이름이 규칙에 어긋나거나 서비스 이름과 겹치면 오류 키를 준다. */
export function toApplyDependencies(drafts: DepDraft[], unitNames: string[]): { dependencies: api.AnalysisDependencyApply[] } | { error: MessageKey } {
  const chosen = drafts.filter((d) => d.provision);
  const names = [...chosen.map((d) => d.name.trim()), ...unitNames];
  if (chosen.some((d) => !SERVICE_NAME_RE.test(d.name.trim()))) return { error: 'create.gate.err.name' };
  if (new Set(names).size !== names.length) return { error: 'create.gate.err.duplicate' };
  return { dependencies: drafts.map((d) => ({ dependencyId: d.id, provision: d.provision, ...(d.provision && { name: d.name.trim() }) })) };
}

const portOf = (value: string) => {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : NaN;
};

/** 선택한 unit 의 apply 요청 본문. 이름·포트가 잘못됐거나 이름이 겹치면 오류 키를 준다. */
export function toApplyUnits(drafts: UnitDraft[]): { units: api.AnalysisUnitApply[] } | { error: MessageKey } {
  const chosen = drafts.filter((d) => d.selected);
  if (chosen.length === 0) return { error: 'create.gate.err.noneSelected' };
  const names = chosen.map((d) => d.name.trim());
  if (names.some((n) => !SERVICE_NAME_RE.test(n))) return { error: 'create.gate.err.name' };
  if (new Set(names).size !== names.length) return { error: 'create.gate.err.duplicate' };
  if (chosen.some((d) => Number.isNaN(portOf(d.port)))) return { error: 'create.gate.err.port' };
  return {
    units: chosen.map((d) => ({
      unitId: d.unitId,
      name: d.name.trim(),
      rootDirectory: d.rootDirectory.trim() || undefined,
      builder: d.builder,
      dockerfilePath: d.builder === 'dockerfile' ? d.dockerfilePath.trim() || undefined : undefined,
      port: portOf(d.port),
    })),
  };
}

const FAILURE_KEYS: Record<string, MessageKey> = {
  ANALYZER_UNAVAILABLE: 'create.gate.err.ANALYZER_UNAVAILABLE',
  ANALYZER_FAILED: 'create.gate.err.ANALYZER_FAILED',
  SOURCE_NOT_ACCESSIBLE: 'create.gate.err.SOURCE_NOT_ACCESSIBLE',
  SOURCE_REF_NOT_FOUND: 'create.gate.err.SOURCE_REF_NOT_FOUND',
  SOURCE_TOO_LARGE: 'create.gate.err.SOURCE_TOO_LARGE',
  SOURCE_INVALID: 'create.gate.err.SOURCE_INVALID',
  ANALYZER_TIMED_OUT: 'create.gate.err.ANALYZER_TIMED_OUT',
  ANALYSIS_INTERRUPTED: 'create.gate.err.ANALYSIS_INTERRUPTED',
};

const REASON_KEYS: Record<string, MessageKey> = {
  single_dockerfile: 'create.gate.reason.single_dockerfile',
  multiple_dockerfiles: 'create.gate.reason.multiple_dockerfiles',
  compose_multi_build: 'create.gate.reason.compose_multi_build',
  compose_multi_service: 'create.gate.reason.compose_multi_service',
  forced: 'create.gate.reason.forced',
};

/** 감지 근거. 코드는 사용자 문장으로 풀어 쓰고, 코드 자체는 작은 회색 글자로만 남긴다. 모르는 코드는 분석기 메시지를 그대로 쓴다. */
function Reasons({ reasons }: { reasons: api.AnalysisReasonDto[] }) {
  const { t } = useI18n();
  if (reasons.length === 0) return null;
  return (
    <ul className="gate-reasons">
      {reasons.map((r, i) => {
        const key = REASON_KEYS[r.code];
        return (
          <li key={`${r.code}-${i}`}>
            <span>{key ? t(key, { n: r.paths?.length ?? 0 }) : r.message}</span>
            {r.paths && r.paths.length > 0 && <span className="gate-paths mono">{r.paths.join(', ')}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** 접었다 펴는 상세 영역. 기본은 접혀 있다. */
function Disclosure({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="gate-disclosure">
      <button type="button" className="gate-disclosure-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <ChevronDown size={14} aria-hidden className={open ? 'open' : ''} />
        {t(open ? 'create.gate.detailsHide' : 'create.gate.details')}
      </button>
      <div id={id} className="gate-disclosure-body" hidden={!open}>{children}</div>
    </div>
  );
}

/** 이미지 태그만(digest 는 뗀다). 전체 값은 title 로 보인다. */
/** 설명은 화면에 풀어 쓰지 않고 ⓘ 아이콘(호버·포커스 툴팁)으로만 둔다. */
function InfoTip({ text }: { text: ReactNode }) {
  const label = typeof text === 'string' ? text : undefined;
  return (
    <Tooltip label={text}>
      <button type="button" className="gate-info" aria-label={label}><Info size={13} aria-hidden /></button>
    </Tooltip>
  );
}

const shortImage = (image?: string | null) => (image ? image.split('@')[0] : '');

type Props = {
  state: AnalysisState;
  busy: boolean;
  drafts: UnitDraft[];
  onDrafts: (next: UnitDraft[]) => void;
  /** 선택한 배포 타깃이 온프레미스면 DB 자동 생성·호스트 별칭을 쓸 수 없다. */
  onPrem?: boolean;
  depDrafts: DepDraft[];
  onDepDrafts: (next: DepDraft[]) => void;
  /** skip 결과로 기존 방식대로 서비스 하나를 만든다(analysisId 포함). */
  onDeploySimple: (analysisId: number) => void;
  /** 분석 없이 서비스 하나를 만든다(기존 경로 그대로). */
  onFallback: () => void;
  onForce: () => void;
  onRetry: () => void;
  onApply: () => void;
};

export function RepoAnalysisStep({ state, busy, drafts, onDrafts, onPrem, depDrafts, onDepDrafts, onDeploySimple, onFallback, onForce, onRetry, onApply }: Props) {
  const { t } = useI18n();
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const pending = state.phase === 'starting' || state.phase === 'running';
  const forced = state.phase === 'starting' ? state.mode === 'force' : state.phase === 'running' && state.analysis.mode === 'force';

  useEffect(() => {
    if (state.phase === 'starting') setStartedAt(Date.now());
  }, [state.phase]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  if (state.phase === 'idle') return null;

  if (pending) {
    const queued = state.phase === 'starting' || state.analysis.status === 'QUEUED';
    return (
      <div className="gate-pending" role="status" aria-live="polite">
        <span className="gate-spinner" aria-hidden />
        <div>
          <h3>{t(forced ? 'create.gate.runningForce' : 'create.gate.running')}</h3>
          <p>{t(queued ? 'create.gate.queued' : 'create.gate.analyzing')} · {t('create.gate.elapsed', { s: Math.max(0, Math.round((now - startedAt) / 1000)) })}</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'failed') {
    const key = state.reason === 'timeout'
      ? 'create.gate.err.timeout'
      : state.reason === 'poll'
        ? 'create.gate.err.poll'
        : state.code && FAILURE_KEYS[state.code];
    return (
      <div className="gate-result">
        <div className="gate-banner failed" role="alert">
          <CircleAlert size={18} />
          <div>
            <h3>{t('create.gate.failedTitle')}</h3>
            <p>{key ? t(key) : state.message || t('create.gate.err.unknown')}</p>
            {key && state.message && state.reason !== 'timeout' && <p className="gate-detail mono">{state.code ?? ''}</p>}
          </div>
        </div>
        <div className="gate-actions">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onRetry}>{t('create.gate.retry')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onFallback}>{t(busy ? 'create.deploying' : 'create.gate.fallback')}</button>
        </div>
      </div>
    );
  }

  const { analysis } = state;
  const result = analysis.result;

  if (result.decision === 'skip') {
    const build = result.simpleBuild;
    return (
      <div className="gate-result">
        <div className="gate-banner skip">
          <Zap size={18} />
          <div>
            <h3>{t('create.gate.skipTitle')}</h3>
          </div>
          <InfoTip text={t('create.gate.skipBody')} />
        </div>
        {build && (
          <dl className="gate-facts">
            <div><dt>{t('create.gate.builder')}</dt><dd>{build.builder === 'dockerfile' ? 'Dockerfile' : 'Railpack'}</dd></div>
            {build.dockerfilePath && <div><dt>{t('create.gate.dockerfile')}</dt><dd className="mono">{build.dockerfilePath}</dd></div>}
            {result.sourceSha && <div><dt>{t('create.gate.commit')}</dt><dd className="mono">{result.sourceSha.slice(0, 7)}</dd></div>}
          </dl>
        )}
        {result.reasons.length > 0 && <Disclosure><Reasons reasons={result.reasons} /></Disclosure>}
        <div className="gate-actions split">
          <button type="button" className="gate-link" disabled={busy} onClick={onForce}><Sparkles size={14} />{t('create.gate.force')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onDeploySimple(analysis.id)}>{t(busy ? 'create.deploying' : 'create.deploy')}</button>
        </div>
      </div>
    );
  }

  const unitById = new Map(result.units.map((u) => [u.id, u]));
  const chosen = drafts.filter((d) => d.selected).length;
  const multi = drafts.length >= 2;
  const update = (unitId: string, patch: Partial<UnitDraft>) => onDrafts(drafts.map((d) => (d.unitId === unitId ? { ...d, ...patch } : d)));
  const nameOf = (unitId?: string | null) => (unitId && drafts.find((d) => d.unitId === unitId)?.name) || unitId;
  const updateDep = (id: string, patch: Partial<DepDraft>) => onDepDrafts(depDrafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  /** unit/의존성 id → 연결될 대상. 선택한 unit 의 서비스나 자동 생성할 DB 만 "자동 연결"이다. */
  const targetOf = (id: string): { name: string; kind: 'unit' | 'db'; auto: boolean } | null => {
    const unit = drafts.find((d) => d.unitId === id);
    if (unit) return { name: unit.name, kind: 'unit', auto: unit.selected };
    const dep = depDrafts.find((d) => d.id === id);
    if (dep) return { name: dep.provision ? dep.name : dep.id, kind: 'db', auto: dep.provision };
    return null;
  };
  /** 플랫폼이 실제로 띄울 이미지가 있으면 그것을, 없으면 분석기가 본 compose 이미지를 보인다. */
  const imageOf = (dep: api.AnalysisDependencyDto) => (!onPrem && analysis.provisioning?.[dep.id]?.image) || dep.image;
  const secrets = (result.secrets ?? []).filter((x) => x.generate === 'random' || x.platformManaged);
  const consumerNames = (x: api.AnalysisSecretDto) => [...new Set(x.consumers.map((c) => targetOf(c.targetId)?.name ?? c.targetId))].join(', ');
  const provisioned = onPrem ? [] : depDrafts.filter((d) => d.provision);
  const unsupported = result.complexity === 'unsupported';

  // 선택한 unit 의 환경변수 중 플랫폼이 채워 주지 못하는 필수 값 = 사용자가 직접 넣어야 하는 항목.
  const selectedUnits = drafts.filter((d) => d.selected).map((d) => unitById.get(d.unitId)).filter((u): u is api.AnalysisUnitDto => !!u);
  const autoKeys = [...new Set(selectedUnits.flatMap((u) => u.env.filter((e) => e.binding && targetOf(e.binding.targetId)?.auto).map((e) => e.key)))];
  const needInput = [...new Set(selectedUnits.flatMap((u) => u.env.filter((e) => e.required && !e.secretId && !(e.binding && targetOf(e.binding.targetId)?.auto)).map((e) => e.key)))];
  const autoParts = [
    secrets.length > 0 && t(secrets.length === 1 ? 'create.gate.autoSecretsOne' : 'create.gate.autoSecrets', { n: secrets.length }),
    autoKeys.length > 0 && t(autoKeys.length === 1 ? 'create.gate.autoLinkedOne' : 'create.gate.autoLinked', { n: autoKeys.length }),
  ].filter(Boolean);
  const portLabel = (d: UnitDraft) => (d.port ? `:${d.port}` : '');
  const builderLabel = (b: api.Builder) => (b === 'dockerfile' ? 'Dockerfile' : 'Railpack');

  return (
    <div className="gate-result">
      <div className="gate-banner analyze">
        <Layers size={18} />
        <div>
          <h3>{unsupported ? t('create.gate.unsupportedTitle') : provisioned.length > 0 ? t('create.gate.summary', { svc: t(chosen === 1 ? 'create.gate.nSvcOne' : 'create.gate.nSvc', { n: chosen }), db: t(provisioned.length === 1 ? 'create.gate.nDbOne' : 'create.gate.nDb', { n: provisioned.length }) }) : t('create.gate.summaryNoDb', { svc: t(chosen === 1 ? 'create.gate.nSvcOne' : 'create.gate.nSvc', { n: chosen }) })}</h3>
        </div>
        {unsupported && <InfoTip text={t('create.gate.unsupportedBody')} />}
      </div>

      {drafts.length > 0 && (
        <ul className="gate-cards" aria-label={t('create.gate.units')}>
          {drafts.map((d) => {
            const body = (
              <>
                <b className="gate-card-name">{d.name || d.unitId}</b>
                <span className="gate-card-meta">{[builderLabel(d.builder), portLabel(d)].filter(Boolean).join(' · ')}</span>
              </>
            );
            return (
              <li key={d.unitId} className={`gate-card${d.selected ? '' : ' off'}`}>
                {multi ? (
                  <label className="gate-card-label">
                    <input type="checkbox" checked={d.selected} onChange={(e) => update(d.unitId, { selected: e.target.checked })} aria-label={t('create.gate.select', { name: d.name || d.unitId })} />
                    <span className="gate-card-text">{body}</span>
                  </label>
                ) : (
                  <div className="gate-card-label"><span className="gate-card-text">{body}</span></div>
                )}
              </li>
            );
          })}
          {result.dependencies.map((dep) => {
            const draft = depDrafts.find((x) => x.id === dep.id);
            if (!draft) return null;
            const on = draft.provision && !onPrem;
            return (
              <li key={dep.id} className={`gate-card db${on ? '' : ' off'}`}>
                <div className="gate-card-label">
                  <Database size={16} aria-hidden />
                  <span className="gate-card-text">
                    <b className="gate-card-name">{on ? draft.name || dep.id : dep.id}</b>
                    <span className="gate-card-meta">{dep.engine === 'other' ? dep.engine : ENGINE_LABEL[dep.engine]} · {t(on ? 'create.gate.cardDb' : 'create.gate.cardDbManual')}</span>
                  </span>
                  {on && <InfoTip text={t('create.gate.demoDb')} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {autoParts.length > 0 && (
        <p className="gate-auto"><Sparkles size={14} aria-hidden /><b>{t('create.gate.autoTitle')}</b><span>{autoParts.join(' · ')}</span>{secrets.length > 0 && <InfoTip text={t('create.gate.autoInfo')} />}</p>
      )}
      {needInput.length > 0 && (
        <p className="gate-warn input" role="note"><CircleAlert size={14} aria-hidden />{t('create.gate.needInput', { n: needInput.length, keys: needInput.join(', ') })}</p>
      )}

      <Disclosure>
        <Reasons reasons={result.reasons} />

        {drafts.length > 0 && (
          <div className="gate-units" role="group" aria-label={t('create.gate.sectionUnits')}>
            <div className="gate-unit-head" aria-hidden>
              <span />
              <span>{t('create.serviceName')}</span>
              <span>{t('create.rootDir')}</span>
              <span>{t('create.gate.builder')}</span>
              <span>{t('create.gate.dockerfile')}</span>
              <span>{t('create.gate.port')}</span>
            </div>
            {drafts.map((d) => {
              const unit = unitById.get(d.unitId);
              const env = unit?.env ?? [];
              const nameOk = SERVICE_NAME_RE.test(d.name.trim());
              return (
                <div key={d.unitId} className={`gate-unit${d.selected ? '' : ' off'}`}>
                  <span className="gate-unit-check" aria-hidden />
                  <label className="gate-cell gate-cell-name">
                    <span className="gate-cell-label">{t('create.serviceName')}</span>
                    <input value={d.name} maxLength={63} aria-invalid={!nameOk} title={t('create.serviceNameRule')} disabled={!d.selected} onChange={(e) => update(d.unitId, { name: e.target.value })} />
                  </label>
                  <label className="gate-cell gate-cell-root">
                    <span className="gate-cell-label">{t('create.rootDir')}</span>
                    <input className="mono" value={d.rootDirectory} disabled={!d.selected} onChange={(e) => update(d.unitId, { rootDirectory: e.target.value })} />
                  </label>
                  <label className="gate-cell gate-cell-builder">
                    <span className="gate-cell-label">{t('create.gate.builder')}</span>
                    <select value={d.builder} disabled={!d.selected} onChange={(e) => update(d.unitId, { builder: e.target.value as api.Builder })}>
                      <option value="dockerfile">Dockerfile</option>
                      <option value="railpack">Railpack</option>
                    </select>
                  </label>
                  <label className="gate-cell gate-cell-dockerfile">
                    <span className="gate-cell-label">{t('create.gate.dockerfile')}</span>
                    <input className="mono" value={d.builder === 'dockerfile' ? d.dockerfilePath : ''} placeholder={d.builder === 'dockerfile' ? 'Dockerfile' : '—'} disabled={!d.selected || d.builder !== 'dockerfile'} onChange={(e) => update(d.unitId, { dockerfilePath: e.target.value })} />
                  </label>
                  <label className="gate-cell gate-cell-port">
                    <span className="gate-cell-label">{t('create.gate.port')}</span>
                    <input inputMode="numeric" value={d.port} placeholder={t('create.gate.portUnknown')} disabled={!d.selected} onChange={(e) => update(d.unitId, { port: e.target.value.replace(/[^0-9]/g, '') })} />
                  </label>
                  <div className="gate-unit-meta">
                    {unit && <span className={`gate-role role-${unit.role}`}>{unit.role}{unit.public ? '' : ` · ${t('create.gate.private')}`}</span>}
                    {env.some((e) => !e.binding) && (
                      <div className="gate-row">
                        <span className="gate-meta-label">{t('create.gate.env')}</span>
                        {env.filter((e) => !e.binding).map((e) => (
                          <span key={e.key} className="gate-keyitem"><span className="gate-code mono">{e.key}</span>{!e.required && <span className="gate-tag">{t('create.gate.optionalEnv')}</span>}</span>
                        ))}
                      </div>
                    )}
                    {unit && unit.dependsOn.length > 0 && (
                      <div className="gate-row"><span className="gate-meta-label">{t('create.gate.dependsOn')}</span><span className="mono">{unit.dependsOn.join(', ')}</span></div>
                    )}
                    {env.some((e) => e.binding) && (
                      <div className="gate-row top">
                        <span className="gate-meta-label">{t('create.gate.link')}</span>
                        <ul className="gate-map" aria-label={t('stack.apply.envMap')}>
                          {env.filter((e) => e.binding).map((e) => {
                            const b = e.binding!;
                            const target = targetOf(b.targetId);
                            const auto = d.selected && !!target?.auto;
                            return (
                              <li key={e.key}>
                                <span className="mono">{e.key}</span>
                                <ArrowRight size={12} aria-hidden className="gate-map-arrow" />
                                <span className="mono">{target?.name ?? b.targetId}.{b.property}</span>
                                <span className={`gate-code ${auto ? 'auto' : 'manual'}`}>{t(auto ? 'create.gate.tagAuto' : 'create.gate.tagManual')}</span>
                                {b.kind === 'dependency' && b.user && <span className="gate-tag">{t('create.gate.userTag', { user: b.user })}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {!onPrem && unit?.hostAliases && unit.hostAliases.length > 0 && (
                      <div className="gate-row top">
                        <span className="gate-meta-label">{t('stack.apply.alias')}</span>
                        <ul className="gate-map" aria-label={t('stack.apply.aliases')}>
                          {unit.hostAliases.map((a) => (
                            <li key={a.host}>
                              <span className="mono">{a.host}{a.port ? `:${a.port}` : ''}</span>
                              <ArrowRight size={12} aria-hidden className="gate-map-arrow" />
                              <span className="mono">{targetOf(a.targetId)?.name ?? a.targetId}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result.dependencies.length > 0 && (
          <section className="gate-deps" aria-label={t('stack.apply.depsTitle')}>
            <h4><Database size={16} aria-hidden /> {t('stack.apply.depsTitle')}</h4>
            <ul className="gate-dep-list">
              {result.dependencies.map((dep) => {
                const draft = depDrafts.find((x) => x.id === dep.id);
                if (!draft) return null;
                const supported = canProvision(dep.engine) && !onPrem;
                const image = imageOf(dep);
                return (
                  <li key={dep.id} className={`gate-dep${draft.provision ? ' on' : ''}`}>
                    <div className="gate-dep-head">
                      <b className="mono">{dep.id}</b>
                      <span className="gate-muted">{dep.engine === 'other' ? dep.engine : ENGINE_LABEL[dep.engine]}</span>
                      {image && <span className="gate-code mono" title={image}>{shortImage(image)}</span>}
                    </div>
                    <label className="gate-dep-toggle">
                      <input type="checkbox" checked={draft.provision && !onPrem} disabled={!supported} onChange={(e) => updateDep(dep.id, { provision: e.target.checked })} />
                      <span>{t('create.gate.provisionLabel')}</span>
                    </label>
                    {(onPrem || !supported || dep.passwordInSource) && (
                      <p className="gate-dep-state">
                        {(onPrem || !supported) && <InfoTip text={t(onPrem ? 'stack.apply.onPrem' : 'stack.apply.unsupported')} />}
                        {dep.passwordInSource && <InfoTip text={t('stack.apply.passwordInSource')} />}
                      </p>
                    )}
                    {dep.initScripts && dep.initScripts.length > 0 && (() => {
                      const ok = dep.initScripts!.filter((x) => x.supported !== false);
                      const skipped = dep.initScripts!.filter((x) => x.supported === false);
                      return (
                        <div className="gate-init">
                          {ok.length > 0 && <p><Database size={12} aria-hidden /> {t('create.gate.initLabel', { n: ok.length, paths: ok.map((x) => x.path).join(', ') })} <InfoTip text={t('create.gate.initInfo')} /></p>}
                          {skipped.length > 0 && <p className="warn"><CircleAlert size={12} aria-hidden /> {t('create.gate.initSkipped', { paths: skipped.map((x) => x.path).join(', ') })}</p>}
                        </div>
                      );
                    })()}
                    {draft.provision && !onPrem && (
                      <div className="gate-dep-fields">
                        <label className="gate-cell gate-dep-name">
                          <span className="gate-cell-label">{t('stack.apply.dbName')}</span>
                          <input value={draft.name} maxLength={63} aria-invalid={!SERVICE_NAME_RE.test(draft.name.trim())} onChange={(e) => updateDep(dep.id, { name: e.target.value })} />
                        </label>
                        <span className="gate-dep-spec gate-muted">{t('stack.apply.spec', { port: dep.port ?? '—' })}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {secrets.length > 0 && (
          <section className="gate-deps" aria-label={t('stack.apply.secretsTitle', { n: secrets.length })}>
            <h4><KeyRound size={16} aria-hidden /> {t('stack.apply.secretsTitle', { n: secrets.length })}<InfoTip text={t('create.gate.autoInfo')} /></h4>
            <ul className="gate-map">
              {secrets.map((x) => (
                <li key={x.id}>
                  <span className="mono">{x.id}</span>
                  <span className="gate-muted">{t(x.generate === 'random' ? 'stack.apply.secretRandom' : 'stack.apply.secretPlatform', { to: consumerNames(x) })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.questions.length > 0 && (
          <p className="gate-tips">
            {t('create.gate.tips', { n: result.questions.length })}
            <InfoTip text={<ul className="gate-tip-list">{result.questions.map((q, i) => <li key={`${q.code}-${i}`}>{q.unitId ? `${nameOf(q.unitId)}: ` : ''}{q.message}</li>)}</ul>} />
          </p>
        )}
      </Disclosure>

      <div className="gate-actions split">
        <button type="button" className={drafts.length > 0 ? 'gate-link' : 'btn btn-primary'} disabled={busy} onClick={onFallback}>{t('create.gate.fallback')}</button>
        {drafts.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={busy || chosen === 0} onClick={onApply}>
            {t(busy ? 'create.gate.applying' : chosen === 1 ? 'create.gate.applyOne' : 'create.gate.apply', { n: chosen })}
          </button>
        )}
      </div>
    </div>
  );
}

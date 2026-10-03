import { useEffect, useState } from 'react';
import { CircleAlert, Database, Layers, Sparkles, Zap } from 'lucide-react';
import type { AnalysisState } from '../data/useRepositoryAnalysis';
import type * as api from '../lib/endpoints';
import { useI18n, type MessageKey } from '../i18n';

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

function Reasons({ reasons }: { reasons: api.AnalysisReasonDto[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="gate-reasons">
      {reasons.map((r, i) => (
        <li key={`${r.code}-${i}`}>
          <span className="gate-code">{r.code}</span>
          <span>{r.message}</span>
          {r.paths && r.paths.length > 0 && <span className="gate-paths mono">{r.paths.join(', ')}</span>}
        </li>
      ))}
    </ul>
  );
}

type Props = {
  state: AnalysisState;
  busy: boolean;
  drafts: UnitDraft[];
  onDrafts: (next: UnitDraft[]) => void;
  /** skip 결과로 기존 방식대로 서비스 하나를 만든다(analysisId 포함). */
  onDeploySimple: (analysisId: number) => void;
  /** 분석 없이 서비스 하나를 만든다(기존 경로 그대로). */
  onFallback: () => void;
  onForce: () => void;
  onRetry: () => void;
  onApply: () => void;
};

export function RepoAnalysisStep({ state, busy, drafts, onDrafts, onDeploySimple, onFallback, onForce, onRetry, onApply }: Props) {
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
            {key && state.message && state.reason !== 'timeout' && <p className="gate-detail mono">{state.code ? `${state.code}: ` : ''}{state.message}</p>}
          </div>
        </div>
        <p className="gate-muted">{t('create.gate.fallbackHint')}</p>
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
            <p>{t('create.gate.skipBody')}</p>
          </div>
        </div>
        {build && (
          <dl className="gate-facts">
            <div><dt>{t('create.gate.builder')}</dt><dd>{build.builder === 'dockerfile' ? 'Dockerfile' : 'Railpack'}</dd></div>
            {build.dockerfilePath && <div><dt>{t('create.gate.dockerfile')}</dt><dd className="mono">{build.dockerfilePath}</dd></div>}
            {result.sourceSha && <div><dt>{t('create.gate.commit')}</dt><dd className="mono">{result.sourceSha.slice(0, 7)}</dd></div>}
          </dl>
        )}
        <Reasons reasons={result.reasons} />
        <div className="gate-actions">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onForce}><Sparkles size={15} />{t('create.gate.force')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onDeploySimple(analysis.id)}>{t(busy ? 'create.deploying' : 'create.deploy')}</button>
        </div>
      </div>
    );
  }

  const unitById = new Map(result.units.map((u) => [u.id, u]));
  const chosen = drafts.filter((d) => d.selected).length;
  const update = (unitId: string, patch: Partial<UnitDraft>) => onDrafts(drafts.map((d) => (d.unitId === unitId ? { ...d, ...patch } : d)));
  const nameOf = (unitId?: string | null) => (unitId && drafts.find((d) => d.unitId === unitId)?.name) || unitId;

  return (
    <div className="gate-result">
      <div className="gate-banner analyze">
        <Layers size={18} />
        <div>
          <h3>{t(result.complexity === 'unsupported' ? 'create.gate.unsupportedTitle' : 'create.gate.analyzeTitle')}</h3>
          <p>{t(result.complexity === 'unsupported' ? 'create.gate.unsupportedBody' : 'create.gate.analyzeBody')}</p>
        </div>
      </div>
      <Reasons reasons={result.reasons} />

      {drafts.length > 0 && (
        <div className="gate-units" role="group" aria-label={t('create.gate.units')}>
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
                <label className="gate-unit-check">
                  <input type="checkbox" checked={d.selected} onChange={(e) => update(d.unitId, { selected: e.target.checked })} aria-label={t('create.gate.select', { name: d.unitId })} />
                </label>
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
                  {env.length > 0 && <span title={t('create.gate.env')}><span className="gate-meta-label">{t('create.gate.env')}</span> <span className="mono">{env.map((e) => e.key + (e.required ? '' : '?')).join(', ')}</span></span>}
                  {unit && unit.dependsOn.length > 0 && <span><span className="gate-meta-label">{t('create.gate.dependsOn')}</span> <span className="mono">{unit.dependsOn.join(', ')}</span></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.dependencies.length > 0 && (
        <div className="gate-deps">
          <Database size={16} />
          <div>
            <p>{t('create.gate.depsNote')}</p>
            <ul>
              {result.dependencies.map((dep) => (
                <li key={dep.id}><span className="mono">{dep.id}</span>{dep.image && <span className="gate-muted mono"> · {dep.image}</span>}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.questions.length > 0 && (
        <div className="gate-questions">
          <h4>{t('create.gate.questions')}</h4>
          <ul>
            {result.questions.map((q, i) => (
              <li key={`${q.code}-${i}`}>{q.unitId && <span className="gate-code">{nameOf(q.unitId)}</span>}{q.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="gate-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onFallback}>{t('create.gate.fallback')}</button>
        {drafts.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={busy || chosen === 0} onClick={onApply}>
            {t(busy ? 'create.gate.applying' : 'create.gate.apply', { n: chosen })}
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowRight, GitCompare, Minus, Plus, Settings2, X } from 'lucide-react';
import { Dialog, useUI } from '../../components/ui';
import { slugify } from '../../components/RepoAnalysisStep';
import type { Project } from '../../data/mock';
import { useProjects } from '../../data/ProjectsContext';
import { repoNameOf } from '../../data/stackModel';
import { useI18n, type MessageKey } from '../../i18n';
import { describeError } from '../../lib/api';
import { networkingErrorKey } from '../../data/networkingError';
import { VariableIssueList } from '../../components/VariableIssues';
import * as api from '../../lib/endpoints';

const TYPE_ICON = { UNIT_ADDED: Plus, UNIT_REMOVED: Minus, UNIT_CHANGED: Settings2, DEPENDENCY_ADDED: Plus, DEPENDENCY_REMOVED: Minus, DEPENDENCY_CHANGED: Settings2 } as const;
const TYPE_KEY: Record<api.StackChangeDto['type'], MessageKey> = {
  UNIT_ADDED: 'stack.change.UNIT_ADDED',
  UNIT_REMOVED: 'stack.change.UNIT_REMOVED',
  UNIT_CHANGED: 'stack.change.UNIT_CHANGED',
  DEPENDENCY_ADDED: 'stack.change.DEPENDENCY_ADDED',
  DEPENDENCY_REMOVED: 'stack.change.DEPENDENCY_REMOVED',
  DEPENDENCY_CHANGED: 'stack.change.DEPENDENCY_CHANGED',
};
const HINT_KEY: Partial<Record<api.StackChangeDto['type'], MessageKey>> = {
  UNIT_ADDED: 'stack.change.hint.UNIT_ADDED',
  UNIT_REMOVED: 'stack.change.hint.UNIT_REMOVED',
  UNIT_CHANGED: 'stack.change.hint.UNIT_CHANGED',
  DEPENDENCY_ADDED: 'stack.change.hint.DEPENDENCY_ADDED',
  DEPENDENCY_REMOVED: 'stack.change.hint.DEPENDENCY_REMOVED',
  DEPENDENCY_CHANGED: 'stack.change.hint.DEPENDENCY_CHANGED',
};

const show = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  // initScripts 는 [{path, sha256}] 라서 경로만 보여 준다.
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' && 'path' in x ? String((x as { path: unknown }).path) : String(x))).join(', ') || '—';
  return String(v);
};

/**
 * "레포 구성 변경 감지" 배너의 변경 diff 와 증분 apply. 새 분석(pendingChanges.analysisId)을 그대로 apply 하면
 * 서버가 unitId 로 기존 서비스와 맞춰 새 unit/의존성만 만들고 바뀐 필드만 갱신한다. 사라진 unit 은 자동으로 지우지 않는다.
 */
export function PendingChangesDialog({ project, stack, onClose, onApplied }: { project: Project; stack: api.StackDto | null; onClose: () => void; onApplied: () => void }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const { refreshProject } = useProjects();
  const pending = stack?.pendingChanges ?? null;
  const [result, setResult] = useState<api.AnalysisGateResultDto | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<api.VariableIssueDto[]>([]);

  useEffect(() => {
    setResult(null);
    setProblem(null);
    if (!pending) return;
    const ctrl = new AbortController();
    api.getRepositoryAnalysis(project.id, pending.analysisId, ctrl.signal).then(
      (a) => { if (!ctrl.signal.aborted) { if (a.result) setResult(a.result); else setProblem(t('stack.pending.noResult')); } },
      (e) => { if (!ctrl.signal.aborted) setProblem(describeError(e)); },
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, pending?.analysisId]);

  if (!stack || !pending) return <Dialog open={false} onClose={onClose}>{null}</Dialog>;

  const apply = async () => {
    if (!result) return;
    setBusy(true);
    setProblem(null);
    const members = stack.services.flatMap((m) => {
      const svc = project.services.find((s) => s.id === String(m.serviceId));
      return svc ? [{ unitId: m.unitId, service: svc }] : [];
    });
    const taken = new Set(project.services.map((s) => s.name));
    const units: api.AnalysisUnitApply[] = result.units.map((u) => {
      const existing = members.find((m) => m.unitId === u.id)?.service;
      let name = existing?.name ?? slugify(u.name);
      for (let i = 2; !existing && taken.has(name); i++) name = `${slugify(u.name)}-${i}`;
      taken.add(name);
      return { unitId: u.id, name };
    });
    const known = new Set(stack.services.map((m) => m.unitId));
    const dependencies: api.AnalysisDependencyApply[] = result.dependencies.filter((d) => !known.has(d.id) && d.engine !== 'other').map((d) => ({ dependencyId: d.id, provision: true }));
    const targetIds = members[0]?.service.remote?.targetIds;
    try {
      const applied = await api.applyRepositoryAnalysis(project.id, pending.analysisId, { units, dependencies, deploy: true, targetIds });
      await refreshProject(project.id).catch(() => undefined);
      onApplied();
      const errors = (applied.variableIssues ?? []).flatMap((v) => v.issues.filter((i) => i.severity === 'error').map((i) => ({ serviceId: v.serviceId, ...i })));
      if (errors.length > 0) {
        // 서비스는 만들어졌지만 배포는 접수되지 않았다. 고친 뒤 스택 재배포를 하도록 이슈를 보여 준다.
        setIssues(errors);
        return;
      }
      toast(t('stack.pending.applied', { n: applied.services.length + (applied.databases?.length ?? 0) }));
      if (applied.changes?.some((c) => c.reason === 'init_scripts_changed')) toast(t('stack.change.hint.init_scripts_changed'));
      onClose();
    } catch (e) {
      const key = networkingErrorKey(e);
      setProblem(key ? t(key) : describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} className="dialog pending-dialog" label={t('stack.pending.title')}>
      <div className="pending-head">
        <h2><GitCompare size={18} aria-hidden /> {t('stack.pending.title')}</h2>
        <button type="button" className="icon-btn" aria-label={t('create.dismiss')} onClick={onClose}><X size={16} /></button>
      </div>
      <p className="st-muted">{t('stack.pending.desc', { repo: repoNameOf(stack.repositoryUrl) })}{pending.sourceSha ? ` · ${pending.sourceSha.slice(0, 7)}` : ''}</p>
      <ul className="pending-changes">
        {pending.changes.map((c, i) => {
          const Icon = TYPE_ICON[c.type] ?? Settings2;
          const hint = HINT_KEY[c.type];
          return (
            <li key={`${c.type}-${c.unitId}-${c.field ?? ''}-${i}`} className={`pending-change ${c.type.startsWith('UNIT_ADDED') || c.type === 'DEPENDENCY_ADDED' ? 'add' : c.type.endsWith('REMOVED') ? 'remove' : 'change'}`}>
              <Icon size={14} aria-hidden />
              <div>
                <p><b>{t(TYPE_KEY[c.type] ?? 'stack.change.UNIT_CHANGED')}</b> <span className="gate-code">{c.unitId}</span></p>
                {(c.type === 'UNIT_CHANGED' || c.type === 'DEPENDENCY_CHANGED') && (
                  <p className="pending-diff mono"><span>{c.field}</span> <del>{show(c.from)}</del> <ArrowRight size={12} aria-hidden /> <ins>{show(c.to)}</ins></p>
                )}
                {c.reason === 'init_scripts_changed' ? <p className="st-muted">{t('stack.change.hint.init_scripts_changed')}</p> : hint && <p className="st-muted">{t(hint)}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {problem && <p className="vars-note error" role="alert">{problem}</p>}
      {issues.length > 0 && (
        <div role="alert">
          <p className="vars-note error">{t('stack.blocked.appliedDesc')}</p>
          <VariableIssueList issues={issues} services={project.services} serviceName={(i) => (i.serviceId ? project.services.find((s) => s.id === String(i.serviceId))?.name : undefined)} />
        </div>
      )}
      <div className="gate-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>{t('service.vars.cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !result || issues.length > 0} onClick={() => void apply()}>{t(busy ? 'stack.pending.applying' : 'stack.pending.apply')}</button>
      </div>
    </Dialog>
  );
}

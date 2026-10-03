import { ChevronDown, Copy, Info, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog, useUI } from '../../components/ui';
import {
  changeKindKey,
  describeFailure,
  evidenceDomId,
  formatElapsed,
  needsFilling,
  splitSnippet,
  stageKey,
  supportKey,
} from '../../data/diagnosisModel';
import { fmtKst, fmtKstFull, type Deployment, type Service } from '../../data/mock';
import { useDiagnosis } from '../../data/useDiagnosis';
import { formatAgo, useI18n } from '../../i18n';
import type { DiagnosisAnalysisDto, DiagnosisChangeDto, DiagnosisDto, DiagnosisEvidenceDto, DiagnosisHypothesisDto, DiagnosisPlanDto } from '../../lib/endpoints';

type Translate = ReturnType<typeof useI18n>['t'];

/** 근거 ID 를 누르면 근거 로그를 펴고 그 줄로 간다. seq 는 같은 ID 를 다시 눌러도 다시 가게 하는 값이다. */
type EvidenceFocus = { id: string; seq: number } | null;

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function BulletList({ items, tone }: { items: string[]; tone?: 'warn' }) {
  return (
    <ul className={`diag-list${tone ? ` ${tone}` : ''}`}>
      {items.map((text, i) => (
        <li key={i}>{text}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="diag-section">
      <h3 className="diag-h">{title}</h3>
      {children}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="diag-block">
      <h4 className="diag-block-h">{title}</h4>
      {children}
    </div>
  );
}

function EvidenceChips({ ids, known, onOpen }: { ids?: string[]; known: Set<string>; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) return null;
  return (
    <div className="diag-chips">
      <span className="diag-label">{t('diag.evidenceIds')}</span>
      {unique.map((id) =>
        known.has(id) ? (
          <button key={id} type="button" className="diag-chip mono" title={t('diag.ev.open')} onClick={() => onOpen(id)}>
            {id}
          </button>
        ) : (
          <span key={id} className="diag-chip mono missing" title={t('diag.ev.missing')}>
            {id}
          </span>
        ),
      )}
    </div>
  );
}

/** 수정 예시. 템플릿이라 `{{NAME}}` 자리표시자를 눈에 띄게 하고, 채워 써야 한다고 알린다. */
function Snippet({ change }: { change: DiagnosisChangeDto & { snippet: string } }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const parts = useMemo(() => splitSnippet(change.snippet), [change.snippet]);
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard is not available');
      await navigator.clipboard.writeText(change.snippet);
      toast(t('diag.snippet.copied'));
    } catch {
      toast(t('diag.snippet.copyFailed'));
    }
  };
  return (
    <>
      <div className="diag-code">
        <div className="diag-code-head">
          <span className="diag-code-lang mono">{change.language ?? ''}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy()}>
            <Copy size={14} />
            {t('diag.snippet.copy')}
          </button>
        </div>
        <pre className="diag-code-body mono">
          <code>
            {parts.map((part, i) =>
              part.placeholder ? (
                <mark key={i} className="diag-ph">
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </code>
        </pre>
      </div>
      {needsFilling(change) && (
        <div className="diag-fill">
          <p className="diag-hint">
            <Info size={14} />
            {t('diag.snippet.template')}
          </p>
          {(change.placeholders?.length ?? 0) > 0 && (
            <dl className="diag-ph-list">
              {change.placeholders!.map((p) => (
                <div key={p.name} className="diag-ph-row">
                  <dt className="mono">{`{{${p.name}}}`}</dt>
                  <dd>{p.description}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </>
  );
}

function Change({ change }: { change: DiagnosisChangeDto }) {
  const { t } = useI18n();
  const kind = changeKindKey(change.kind);
  return (
    <div className="diag-change">
      <div className="diag-change-head">
        {kind && <span className="diag-tag">{t(kind)}</span>}
        <b className="diag-change-target">{change.target}</b>
      </div>
      <p className="diag-text">{change.instruction}</p>
      {change.targetKnown === false && (
        <p className="diag-hint">
          <Info size={14} />
          {t('diag.change.targetUnverified')}
        </p>
      )}
      {change.snippet && <Snippet change={{ ...change, snippet: change.snippet }} />}
    </div>
  );
}

function Plan({ plan, index, total, known, onOpen }: { plan: DiagnosisPlanDto; index: number; total: number; known: Set<string>; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const { applyWhen = [], changes = [], verification = [], rollback = [], risks = [] } = plan;
  return (
    <details className="diag-plan" open>
      <summary className="diag-plan-sum">
        {total > 1 && <span className="diag-plan-no">{index + 1}</span>}
        <span className="diag-plan-title">{plan.title}</span>
        <ChevronDown className="diag-plan-chev" size={16} />
      </summary>
      <div className="diag-plan-body">
        {applyWhen.length > 0 && (
          <Block title={t('diag.plan.applyWhen')}>
            <BulletList items={applyWhen} />
          </Block>
        )}
        {changes.length > 0 && (
          <Block title={t('diag.plan.changes')}>
            <div className="diag-changes">
              {changes.map((change, i) => (
                <Change key={i} change={change} />
              ))}
            </div>
          </Block>
        )}
        {verification.length > 0 && (
          <Block title={t('diag.plan.verify')}>
            <ol className="diag-steps">
              {verification.map((v, i) => (
                <li key={i}>
                  <p className="diag-text">{v.instruction}</p>
                  {v.expectedResult && (
                    <p className="diag-expected">
                      <b>{t('diag.plan.expected')}</b> {v.expectedResult}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Block>
        )}
        {rollback.length > 0 && (
          <Block title={t('diag.plan.rollback')}>
            <BulletList items={rollback} />
          </Block>
        )}
        {risks.length > 0 && (
          <Block title={t('diag.plan.risks')}>
            <BulletList items={risks} tone="warn" />
          </Block>
        )}
        <EvidenceChips ids={plan.evidenceIds} known={known} onOpen={onOpen} />
      </div>
    </details>
  );
}

function Hypothesis({ h, known, onOpen }: { h: DiagnosisHypothesisDto; known: Set<string>; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const level = supportKey(h.supportLevel);
  return (
    <li className="diag-cause">
      <span className={`diag-badge ${level ? h.supportLevel : 'other'}`}>{level ? t(level) : h.supportLevel}</span>
      <p className="diag-cause-text">{h.statement}</p>
      {h.uncertainty && (
        <p className="diag-uncertainty">
          <b>{t('diag.uncertainty')}</b> {h.uncertainty}
        </p>
      )}
      <EvidenceChips ids={h.evidenceIds} known={known} onOpen={onOpen} />
    </li>
  );
}

/** 근거로 쓴 로그 줄. 기본은 접혀 있고, 근거 ID 를 누르면 펴지면서 그 줄이 강조된다. */
function EvidenceLog({ diagnosisId, evidence, open, onToggle, focus }: { diagnosisId: number; evidence: DiagnosisEvidenceDto[]; open: boolean; onToggle: () => void; focus: EvidenceFocus }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open || !focus) return;
    const row = document.getElementById(evidenceDomId(diagnosisId, focus.id));
    if (!row) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    row.focus({ preventScroll: true });
  }, [open, focus, diagnosisId]);

  return (
    <section className="diag-section">
      <h3 className="diag-h">
        <button type="button" className="diag-toggle" aria-expanded={open} onClick={onToggle}>
          {t('diag.sec.evidence', { n: evidence.length })}
          <ChevronDown size={16} className="diag-toggle-chev" />
        </button>
      </h3>
      {open && (
        <>
          <p className="diag-hint">
            <Info size={14} />
            {t('diag.ev.hint')}
          </p>
          <ol className="diag-ev-list">
            {evidence.map((line, i) => {
              const stage = stageKey(line.stage);
              // 서버가 줄마다 시각을 주지 못하면 같은 값이 이어지니, 바뀔 때만 보여준다.
              const time = line.timestamp && line.timestamp !== evidence[i - 1]?.timestamp ? fmtKst(line.timestamp).slice(11) : '';
              return (
                <li
                  key={line.id}
                  id={evidenceDomId(diagnosisId, line.id)}
                  tabIndex={-1}
                  className="diag-ev-row"
                  data-focus={focus?.id === line.id}
                  title={line.timestamp ? fmtKstFull(line.timestamp) : undefined}
                >
                  <span className="diag-ev-id mono">{line.id}</span>
                  <span className="diag-ev-meta">{[stage ? t(stage) : line.stage, time].filter(Boolean).join(' · ')}</span>
                  <code className="diag-ev-text mono">{line.text}</code>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function remediationNotice(analysis: DiagnosisAnalysisDto, t: Translate) {
  switch (analysis.remediation.status) {
    case 'needs_more_evidence': return t('diag.remed.needMore');
    case 'not_needed': return t('diag.remed.notNeeded');
    default: return t('diag.remed.empty');
  }
}

function Result({ diagnosis, analysis, busy, onRerun }: { diagnosis: DiagnosisDto; analysis: DiagnosisAnalysisDto; busy: boolean; onRerun: () => void }) {
  const { t, lang } = useI18n();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [focus, setFocus] = useState<EvidenceFocus>(null);

  const evidence = diagnosis.evidence ?? [];
  const known = useMemo(() => new Set(evidence.map((e) => e.id)), [evidence]);
  const openEvidence = (id: string) => {
    setEvidenceOpen(true);
    setFocus((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
  };

  const hypotheses = analysis.hypotheses ?? [];
  const plans = analysis.remediation.plans ?? [];
  const checks = analysis.nextChecks ?? [];
  const missing = analysis.missingInformation ?? [];
  const limits = [...new Set([...(analysis.limitations ?? []), ...(diagnosis.inputLimitations ?? [])])];
  const notice = analysis.analysisStatus === 'insufficient_evidence' ? 'insufficient' : analysis.analysisStatus === 'no_failure_evidence' ? 'noFailure' : null;
  const doneAt = diagnosis.finishedAt ?? diagnosis.createdAt;

  return (
    <>
      <div className="diag-bar">
        <div className="diag-bar-left">
          <Sparkles size={16} className="diag-spark" />
          <b>{t('diag.action')}</b>
          <time className="diag-muted" title={fmtKstFull(doneAt)}>
            {t('diag.result.when', { ago: formatAgo(doneAt, lang) })}
          </time>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={onRerun}>
          <RefreshCw size={14} />
          {t('diag.rerun')}
        </button>
      </div>
      <p className="diag-hint">
        <Info size={14} />
        {t('diag.suggestionNote')}
      </p>

      <section className="diag-summary" aria-label={t('diag.sec.summary')}>
        <p>{analysis.summary}</p>
      </section>

      {notice && (
        <div className="diag-notice" role="status">
          <TriangleAlert size={16} />
          <div>
            <b>{t(`diag.status.${notice}.title`)}</b>
            <p>{t(`diag.status.${notice}.body`)}</p>
          </div>
        </div>
      )}

      {(hypotheses.length > 0 || analysis.analysisStatus === 'diagnosed') && (
        <Section title={t('diag.sec.causes')}>
          {hypotheses.length === 0 ? (
            <p className="diag-muted">{t('diag.sec.causes.empty')}</p>
          ) : (
            <ul className="diag-causes">
              {hypotheses.map((h) => (
                <Hypothesis key={h.id} h={h} known={known} onOpen={openEvidence} />
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={t('diag.sec.fixes')}>
        {plans.length === 0 && <p className="diag-text">{remediationNotice(analysis, t)}</p>}
        {analysis.remediation.reason && <p className="diag-muted">{analysis.remediation.reason}</p>}
        {plans.length > 0 && (
          <div className="diag-plans">
            {plans.map((plan, i) => (
              <Plan key={plan.id} plan={plan} index={i} total={plans.length} known={known} onOpen={openEvidence} />
            ))}
          </div>
        )}
      </Section>

      {checks.length > 0 && (
        <Section title={t('diag.sec.checks')}>
          <ul className="diag-items">
            {checks.map((c) => (
              <li key={c.id}>
                <b>{c.target}</b>
                <p className="diag-text">{c.method}</p>
                <p className="diag-muted">
                  <b>{t('diag.check.purpose')}</b> {c.purpose}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {missing.length > 0 && (
        <Section title={t('diag.sec.missing')}>
          <ul className="diag-items">
            {missing.map((m, i) => (
              <li key={i}>
                <b>{m.requestedData}</b>
                <p className="diag-muted">
                  <b>{t('diag.missing.reason')}</b> {m.reason}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {evidence.length > 0 && (
        <EvidenceLog diagnosisId={diagnosis.id} evidence={evidence} open={evidenceOpen} onToggle={() => setEvidenceOpen((v) => !v)} focus={focus} />
      )}

      {limits.length > 0 && (
        <Section title={t('diag.sec.limits')}>
          <BulletList items={limits} />
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function Running({ createdAt }: { createdAt: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="diag-card">
      <div className="diag-spinner" aria-hidden="true" />
      <div role="status">
        <h2 className="diag-card-title">{t('diag.running.title')}</h2>
        <p className="diag-card-body">{t('diag.running.body')}</p>
      </div>
      <p className="diag-muted mono" aria-hidden="true">
        {t('diag.running.elapsed', { time: formatElapsed(now - Date.parse(createdAt)) })}
      </p>
    </section>
  );
}

function Failed({ errorCode, base, busy, onRetry }: { errorCode?: string; base: string; busy: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  const { reason, kind } = describeFailure(errorCode);
  const hint = { 'no-logs': 'diag.fail.hint.noLogs', retry: 'diag.fail.hint.retry', internal: 'diag.fail.hint.internal' } as const;
  return (
    <section className="diag-card error" role="alert">
      <div className="diag-card-icon">
        <TriangleAlert size={20} />
      </div>
      <div>
        <h2 className="diag-card-title">{t('diag.fail.title')}</h2>
        <p className="diag-card-body">{t(reason)}</p>
        <p className="diag-muted">{t(hint[kind])}</p>
      </div>
      <div className="diag-card-actions">
        {kind === 'no-logs' && (
          <>
            <Link to={`${base}/build`} className="btn btn-primary">
              {t('diag.fail.openBuild')}
            </Link>
            <Link to={`${base}/deploy`} className="btn btn-outline">
              {t('diag.fail.openDeploy')}
            </Link>
          </>
        )}
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onRetry}>
          <RefreshCw size={16} />
          {busy ? t('diag.starting') : t('diag.retry')}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

/**
 * 실패한 배포의 AI 진단. 진단이 아직 없으면 안내(서버가 자동으로 시작한다), 진행 중이면 진행 표시, 성공하면 요약·원인·해결책·근거, 실패하면 이유와 다시 시도를 보여준다.
 * 해결책은 제안일 뿐이라 서버가 실행하지 않고 배포 상태도 바뀌지 않는다. base 는 이 배포 패널의 주소(`…/deployment/{id}`)다.
 */
export function DiagnosisPanel({ service, deployment, base }: { service: Service; deployment: Deployment; base: string }) {
  const { t } = useI18n();
  const { view, starting, startError, start, retry, reload } = useDiagnosis(service.id, deployment.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  let body: ReactNode;
  if (view.kind === 'loading') {
    body = <p className="diag-muted">{t('diag.loading')}</p>;
  } else if (view.kind === 'error') {
    body = (
      <section className="diag-card error" role="alert">
        <div className="diag-card-icon">
          <TriangleAlert size={20} />
        </div>
        <h2 className="diag-card-title">{t('diag.loadError')}</h2>
        <div className="diag-card-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <RefreshCw size={16} />
            {t('diag.retry')}
          </button>
        </div>
      </section>
    );
  } else if (view.kind === 'none') {
    // 진단은 서버가 배포 실패를 확정할 때 스스로 시작한다. 사용자가 누르는 시작 버튼은 없다.
    body = (
      <section className="diag-card" role="status">
        <div className="diag-card-icon accent">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="diag-card-title">{t('diag.none.title')}</h2>
          <p className="diag-card-body">{t('diag.none.body')}</p>
          <p className="diag-muted">{t('diag.none.note')}</p>
        </div>
      </section>
    );
  } else {
    const d = view.diagnosis;
    if (d.status === 'RUNNING' && view.stale) {
      body = (
        <section className="diag-card error" role="alert">
          <div className="diag-card-icon">
            <TriangleAlert size={20} />
          </div>
          <div>
            <h2 className="diag-card-title">{t('diag.stale.title')}</h2>
            <p className="diag-card-body">{t('diag.stale.body')}</p>
          </div>
          <div className="diag-card-actions">
            <button type="button" className="btn btn-primary" disabled={starting} onClick={() => void start()}>
              <RefreshCw size={16} />
              {starting ? t('diag.starting') : t('diag.restart')}
            </button>
          </div>
        </section>
      );
    } else if (d.status === 'RUNNING') {
      body = <Running createdAt={d.createdAt} />;
    } else if (d.status === 'SUCCEEDED' && d.analysis) {
      body = <Result diagnosis={d} analysis={d.analysis} busy={starting} onRerun={() => setConfirmOpen(true)} />;
    } else {
      // FAILED. 분석 없이 SUCCEEDED 로 온 이상한 응답도 같은 안내로 받는다.
      body = <Failed errorCode={d.errorCode} base={base} busy={starting} onRetry={() => void retry()} />;
    }
  }

  return (
    <div className="diag">
      {startError && (
        <p className="diag-alert" role="alert">
          <TriangleAlert size={16} />
          {startError}
        </p>
      )}
      {body}
      <ConfirmDialog
        open={confirmOpen}
        title={t('diag.confirm.title')}
        confirmLabel={t('diag.rerun')}
        cancelLabel={t('diag.cancel')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void start(true);
        }}
      >
        {t('diag.confirm.body')}
      </ConfirmDialog>
    </div>
  );
}

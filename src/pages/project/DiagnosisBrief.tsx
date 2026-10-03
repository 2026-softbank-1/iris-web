import { environmentVariableNames, environmentVariablesUrl } from '../../data/environmentConfiguration';
import { EnvironmentVariablesNotice } from './EnvironmentVariablesNotice';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { triggerAutomaticRepair } from '../../lib/automaticRepair';
import { ApiError, describeError } from '../../lib/api';
import { describeFailure, isAutoDiagnosisPending, supportKey } from '../../data/diagnosisModel';
import { fmtKstFull, type Service } from '../../data/mock';
import { useDiagnosis } from '../../data/useDiagnosis';
import { formatAgo, useI18n } from '../../i18n';
import { githubInstallUrl, type DiagnosisAnalysisDto } from '../../lib/endpoints';

/**
 * 서비스 실패 배너 아래에 보여 주는, 가장 최근 실패한 배포의 AI 진단 요약. 결과를 짧게 보여 주고 상세 페이지로 가는 버튼과,
 * 코드수정 화면으로 가는 `AI 수정` 버튼을 둔다. 진단 상태는 배포 패널의 AI 진단 탭과 같은 훅으로 받는다.
 */
export function DiagnosisBrief({ service, deploymentId, updatedAt, to }: { service: Service; deploymentId: string; updatedAt: string; to: string }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairError, setRepairError] = useState('');
  const [needsAccess, setNeedsAccess] = useState(false);
  const running = useRef(false);
  const { view } = useDiagnosis(service.id, deploymentId);

  const diagnosis = view.kind === 'ready' ? view.diagnosis : undefined;
  const analysis = diagnosis?.status === 'SUCCEEDED' ? diagnosis.analysis : undefined;
  const [requiredNames, setRequiredNames] = useState<string[] | null>(null);
  const environmentNames = environmentVariableNames(diagnosis);
  const needsEnvironment = requiredNames !== null || environmentNames.length > 0;
  const doneAt = diagnosis && diagnosis.status !== 'RUNNING' ? (diagnosis.finishedAt ?? diagnosis.createdAt) : undefined;

  async function fix() {
    if (running.current) return;
    running.current = true; setRepairBusy(true); setRepairError('');
    try { await triggerAutomaticRepair(service.id, deploymentId, diagnosis?.id); navigate(`${to}#repair`); }
    catch (e) { if (e instanceof ApiError && e.code === 'CONFIGURATION_VALUES_REQUIRED') { setRequiredNames(e.details.map(d => d.field)); return; } setRepairError(e instanceof ApiError && e.code === 'SOURCE_HEAD_CHANGED' ? t('repair.changed') : describeError(e)); setNeedsAccess(e instanceof ApiError && e.status === 403); }
    finally { running.current = false; setRepairBusy(false); }
  }

  let body;
  if (view.kind === 'loading') {
    body = <p className="diag-brief-muted">{t('diag.loading')}</p>;
  } else if (view.kind === 'error') {
    body = <p className="diag-brief-muted">{t('diag.loadError')}</p>;
  } else if (view.kind === 'none') {
    body = <p className="diag-brief-muted">{t(isAutoDiagnosisPending(updatedAt) ? 'diag.none.title' : 'diag.none.old.title')}</p>;
  } else if (view.diagnosis.status === 'RUNNING') {
    body = view.stale ? (
      <p className="diag-brief-muted">{t('diag.stale.title')}</p>
    ) : (
      <p className="diag-brief-muted diag-brief-running" role="status">
        <span className="diag-spinner sm" aria-hidden="true" />
        {t('diag.running.title')}
      </p>
    );
  } else if (analysis) {
    body = <Result analysis={analysis} />;
  } else {
    body = <p className="diag-brief-muted">{`${t('diag.fail.title')} · ${t(describeFailure(view.diagnosis.errorCode).reason)}`}</p>;
  }

  return (
    <section className="diag-brief" aria-label={t('diag.action')}>
      <div className="diag-brief-head">
        <Sparkles size={16} className="diag-spark" />
        <b>{t('diag.action')}</b>
        {doneAt && (
          <time className="diag-brief-time" title={fmtKstFull(doneAt)}>
            {t('diag.result.when', { ago: formatAgo(doneAt, lang) })}
          </time>
        )}
      </div>
      {body}
      {needsEnvironment && <EnvironmentVariablesNotice names={requiredNames ?? environmentNames} variablesUrl={environmentVariablesUrl(to)} />}
      {repairError && <p role="alert">{repairError}</p>}
      {needsAccess && <a href={githubInstallUrl()} className="btn btn-outline">{t('repair.connect')}</a>}
      <div className="diag-brief-actions">
        <Link to={to} className="btn btn-outline">
          {t('diag.brief.detail')}
          <ChevronRight size={16} />
        </Link>
        {!needsEnvironment && <button type="button" onClick={() => void fix()} disabled={repairBusy} className="btn btn-primary">
          <Sparkles size={16} />
          {t(repairBusy ? 'repair.loading' : 'diag.brief.fix')}
        </button>}
      </div>
    </section>
  );
}

/** 요약, 가장 앞의 원인과 해결책 하나씩(나머지는 개수만). 전체는 상세 페이지에서 본다. */
function Result({ analysis }: { analysis: DiagnosisAnalysisDto }) {
  const { t } = useI18n();
  const causes = analysis.hypotheses ?? [];
  const plans = analysis.remediation.plans ?? [];
  const cause = causes[0];
  const plan = plans[0];
  const level = cause && supportKey(cause.supportLevel);
  const notice = analysis.analysisStatus === 'insufficient_evidence' ? 'insufficient' : analysis.analysisStatus === 'no_failure_evidence' ? 'noFailure' : null;
  return (
    <>
      <p className="diag-brief-summary">{analysis.summary}</p>
      {notice && <p className="diag-brief-muted">{t(`diag.status.${notice}.title`)}</p>}
      {(cause || plan) && (
        <dl className="diag-brief-rows">
          {cause && (
            <div className="diag-brief-row">
              <dt>{t('diag.sec.causes')}</dt>
              <dd>
                {level && <span className={`diag-badge ${cause.supportLevel}`}>{t(level)}</span>}
                <span className="diag-brief-line">{cause.statement}</span>
                {causes.length > 1 && <span className="diag-brief-more">{t('diag.brief.more', { n: causes.length - 1 })}</span>}
              </dd>
            </div>
          )}
          {plan && (
            <div className="diag-brief-row">
              <dt>{t('diag.sec.fixes')}</dt>
              <dd>
                <span className="diag-brief-line">{plan.title}</span>
                {plans.length > 1 && <span className="diag-brief-more">{t('diag.brief.more', { n: plans.length - 1 })}</span>}
              </dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

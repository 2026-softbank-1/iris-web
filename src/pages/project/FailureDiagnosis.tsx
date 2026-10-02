import { CircleCheck, LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { useDiagnosis } from '../../data/useDiagnosis';
import type { DiagnosisEvidence, RemediationPlan } from '../../lib/diagnosisApi';
import '../../styles/analysis.css';

function LogEvidence({ ids, evidence }: { ids: string[]; evidence: DiagnosisEvidence[] }) {
  return <ul className="analysis-evidence">{ids.map((id) => {
    const item = evidence.find((entry) => entry.id === id);
    return <li key={id}><details><summary><code>{id}</code>{item && <span>{item.source_id} · {item.stage} · line {item.source_line ?? item.chunk_line}</span>}</summary><pre>{item?.text ?? 'Evidence line is not available in this response.'}</pre></details></li>;
  })}</ul>;
}

function Remediation({ plan, evidence }: { plan: RemediationPlan; evidence: DiagnosisEvidence[] }) {
  return <details className="diagnosis-plan"><summary><b>{plan.title}</b></summary>
    <h4>Apply when</h4><ul>{plan.apply_when.map((item, index) => <li key={index}>{item}</li>)}</ul>
    {plan.changes.map((change, index) => <div key={index}><p><b>{change.target}</b> · {change.kind}{!change.target_known && ' · target requires confirmation'}</p><p>{change.instruction}</p><pre>{change.snippet}</pre>{change.placeholders.map((placeholder) => <p className="analysis-muted" key={placeholder.name}><code>{`{{${placeholder.name}}}`}</code> {placeholder.description}</p>)}</div>)}
    <h4>Verify</h4><ul>{plan.verification.map((check, index) => <li key={index}>{check.instruction}<p className="analysis-muted">Expected: {check.expected_result}</p></li>)}</ul>
    <h4>Rollback</h4><ul>{plan.rollback.map((item, index) => <li key={index}>{item}</li>)}</ul>
    <h4>Risks</h4><ul>{plan.risks.map((item, index) => <li key={index}>{item}</li>)}</ul>
    <LogEvidence ids={plan.evidence_ids} evidence={evidence} />
  </details>;
}

export function FailureDiagnosis({ serviceId, deploymentId }: { serviceId: string; deploymentId: string }) {
  const { job, loading, busy, active, error, start, reload } = useDiagnosis(serviceId, deploymentId);
  const result = job?.result;
  const analysis = result?.analysis;
  const evidence = result?.evidence ?? [];
  const terminalError = job?.status === 'FAILED' || job?.status === 'TIMED_OUT';
  return <section className="diagnosis-panel" aria-label="Failure log diagnosis">
    <div className="analysis-header"><div><h3>Failure log diagnosis</h3><p className="analysis-muted">Analyze this deployment attempt’s masked logs to find evidence and next checks.</p></div><button type="button" className="btn btn-outline btn-icon-only" aria-label="Refresh diagnosis" disabled={loading || busy} onClick={() => void reload()}><RotateCw size={16} /></button></div>
    {!job && <button type="button" className="btn btn-primary" disabled={loading || busy} onClick={() => void start()}>{busy ? 'Requesting…' : 'Analyze failure logs'}</button>}
    {error && <p className="analysis-notice error" role="alert"><TriangleAlert size={16} />{error}</p>}
    {job && <div className="analysis-card analysis-progress" aria-live="polite"><div className="analysis-field-title">{active ? <LoaderCircle size={16} className="analysis-spinner" /> : terminalError ? <TriangleAlert size={16} /> : <CircleCheck size={16} />}<b>{active ? 'Diagnosing failure logs' : terminalError ? 'Log diagnosis could not finish' : 'Log diagnosis complete'}</b><span className="analysis-muted">{job.stage}</span></div><p className="analysis-muted">Attempt <code>{job.attemptId}</code> · {new Date(job.updatedAt).toLocaleString()}</p>{terminalError && <p className="analysis-notice error">{job.status === 'TIMED_OUT' ? 'The diagnosis timed out.' : 'The diagnosis worker failed.'} The deployment retains its original failure status. {job.errorCode && <code>{job.errorCode}</code>}</p>}</div>}
    {analysis && <>
      <div className="analysis-card analysis-card-body"><div className="analysis-field-title"><b>{analysis.analysis_status === 'diagnosed' ? 'Evidence supports a diagnosis' : analysis.analysis_status === 'insufficient_evidence' ? 'More evidence is needed' : 'No failure evidence in the collected logs'}</b></div><p>{analysis.summary}</p></div>
      <section className="analysis-card"><div className="analysis-card-body"><h3>Observed facts</h3>{analysis.observations.map((item) => <div key={item.id}><div className="analysis-field-title"><code>{item.id}</code><span className="analysis-badge detected">{item.kind}</span></div><p>{item.text}</p><LogEvidence ids={item.evidence_ids} evidence={evidence} /></div>)}</div></section>
      <section className="analysis-card"><div className="analysis-card-body"><h3>Cause candidates</h3>{analysis.hypotheses.length === 0 && <p className="analysis-muted">No supported cause candidate was returned.</p>}{analysis.hypotheses.map((item) => <div key={item.id}><div className="analysis-field-title"><code>{item.id}</code><span className="analysis-badge suggested">{item.category} · {item.support_level}</span></div><p>{item.statement}</p><p className="analysis-muted">{item.uncertainty}</p><LogEvidence ids={item.evidence_ids} evidence={evidence} />{item.counter_evidence_ids.length > 0 && <><p className="analysis-muted">Counter evidence</p><LogEvidence ids={item.counter_evidence_ids} evidence={evidence} /></>}</div>)}</div></section>
      <section className="analysis-card"><div className="analysis-card-body"><h3>Next checks</h3>{analysis.next_checks.map((check) => <div key={check.id}><b>{check.target}</b><p>{check.method}</p><p className="analysis-muted">Purpose: {check.purpose}</p></div>)}</div></section>
      {analysis.remediation && <section className="analysis-card"><div className="analysis-card-body"><h3>Proposed remediation</h3><p>{analysis.remediation.reason}</p><p className="analysis-muted">These proposals have not been executed. Verify the conditions before applying any change.</p>{analysis.remediation.plans.map((plan) => <Remediation key={plan.id} plan={plan} evidence={evidence} />)}</div></section>}
      <details className="analysis-card"><summary><b>Missing information & limitations</b></summary><div className="analysis-card-body">{analysis.missing_information.map((item, index) => <div key={index}><b>{item.requested_data}</b><p>{item.reason}</p></div>)}{[...analysis.limitations, ...(result?.input_limitations ?? [])].map((item, index) => <p className="analysis-muted" key={index}>{item}</p>)}</div></details>
    </>}
  </section>;
}

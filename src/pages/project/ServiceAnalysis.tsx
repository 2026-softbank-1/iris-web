import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, FileSearch, LoaderCircle, RotateCw, Square, TriangleAlert } from 'lucide-react';
import { useProjects } from '../../data/ProjectsContext';
import { useAnalysis } from '../../data/useAnalysis';
import { usePipeline } from '../../data/usePipeline';
import { pipelineFailureMessage, pipelineLabel, pipelineSteps } from '../../data/pipelineModel';
import { initialPipelineVariables, pipelineVariables, type PipelineVariableDraft } from '../../data/pipelineReview';
import { displayAnalysisValue, candidateBuildAdvice, fillEmptyRecommendations, initialReviewDraft, reviewAnswers, type AnalysisReviewDraft } from '../../data/analysisReview';
import type { Project, Service } from '../../data/mock';
import type { AnalysisCandidate, AnalysisDto, AnalysisEvidence, AnalysisField, AnalysisMode, JsonValue, VerificationDecision } from '../../lib/analysisApi';
import { describeError } from '../../lib/api';
import type { PipelineAnswers, PipelineDto } from '../../lib/pipelineApi';
import '../../styles/analysis.css';

const statusLabel = { QUEUED: 'Queued', RUNNING: 'Analyzing', SUCCEEDED: 'Analysis finished', FAILED: 'Analysis failed', CANCELLED: 'Cancelled' };
const analysisLabel = { complete: 'Source analysis complete', needs_input: 'Additional review required', unsupported: 'Source is unsupported' };
const executionError = (code?: string) => code === 'ANALYSIS_TIMED_OUT' ? 'Analysis timed out. Try again, or choose Static analysis.'
  : code === 'INVALID_ANALYZER_RESULT' ? 'The analyzer returned an invalid result. No settings were saved.'
    : code === 'MODEL_NOT_CONFIGURED' ? 'AI model credentials are missing. Choose Static analysis or ask the operator to configure AI analysis.'
      : 'The analysis could not finish. Existing service settings remain available. Try again or ask the operator to inspect the analysis worker.';

function Evidence({ ids, evidence }: { ids: string[]; evidence: AnalysisEvidence[] }) {
  if (!ids.length) return <span className="analysis-muted">No source evidence</span>;
  return <ul className="analysis-evidence">{ids.map((id) => {
    const item = evidence.find((entry) => entry.evidenceId === id);
    return <li key={id}>{item?.text ? <details><summary><code>{item.path}:{item.startLine}{item.endLine !== item.startLine ? `–${item.endLine}` : ''}</code>{item.redacted && <span> · redacted</span>}</summary><pre className="analysis-snippet">{item.text}</pre></details> : <code>{item ? `${item.path}:${item.startLine}–${item.endLine}` : id}</code>}</li>;
  })}</ul>;
}

function Field({ label, field, evidence }: { label: string; field: AnalysisField; evidence: AnalysisEvidence[] }) {
  return <div className="analysis-field">
    <div className="analysis-field-title"><b>{label}</b><span className={`analysis-badge ${field.status}`}>{field.status}</span><span className="analysis-muted">{field.scope}</span></div>
    <code className="analysis-value">{displayAnalysisValue(field.value)}</code>
    <p className="analysis-muted">{field.reason}</p>
    <Evidence ids={field.evidenceIds} evidence={evidence} />
  </div>;
}

function Candidate({ candidate, evidence }: { candidate: AnalysisCandidate; evidence: AnalysisEvidence[] }) {
  return <details className="analysis-card" open>
    <summary><FileSearch size={16} /><b>{candidate.serviceId}</b><code>{displayAnalysisValue(candidate.root.value)}</code></summary>
    <div className="analysis-fields">
      <Field label="Source root" field={candidate.root} evidence={evidence} />
      <Field label="Role" field={candidate.role} evidence={evidence} />
      <Field label="Runtime" field={candidate.runtime} evidence={evidence} />
      <Field label="Build command" field={candidate.buildCommand} evidence={evidence} />
      <Field label="Start command" field={candidate.startCommand} evidence={evidence} />
      <Field label="Output directory" field={candidate.outputDirectory} evidence={evidence} />
      {candidate.workingDirectory && <Field label="Working directory" field={candidate.workingDirectory} evidence={evidence} />}
      {candidate.ports.map((field, index) => <Field key={`port-${index}`} label="Port" field={field} evidence={evidence} />)}
      {candidate.healthchecks.map((field, index) => <Field key={`health-${index}`} label="Healthcheck" field={field} evidence={evidence} />)}
    </div>
  </details>;
}

function Verification({ decisions, evidence }: { decisions: VerificationDecision[]; evidence: AnalysisEvidence[] }) {
  return <details className="analysis-card">
    <summary><b>Verification</b><span className="analysis-muted">{decisions.filter((d) => d.decision === 'supported').length} supported · {decisions.filter((d) => d.decision === 'rejected').length} rejected · {decisions.filter((d) => d.decision === 'deferred').length} deferred</span></summary>
    <div className="analysis-card-body">{decisions.length === 0 && <p className="analysis-muted">No AI proposals required semantic verification.</p>}{decisions.map((decision, index) => <div className="analysis-decision" key={`${decision.fieldPath}-${index}`}>
      <div className="analysis-field-title"><code>{decision.fieldPath.join('.')}</code><span className={`analysis-badge ${decision.decision}`}>{decision.decision}</span></div>
      <p>{decision.reason}</p><p className="analysis-muted">{decision.reasonCode}</p>
      <Evidence ids={decision.evidenceIds} evidence={evidence} />
      {decision.supportingLocators?.map((locator, i) => <code className="analysis-locator" key={i}>{locator.path}:{locator.startLine}–{locator.endLine}</code>)}
      {decision.missingObligations?.map((obligation, i) => <p className="analysis-muted" key={i}>{obligation}</p>)}
    </div>)}</div>
  </details>;
}

function Artifact({ label, value }: { label: string; value?: Record<string, JsonValue> }) {
  return value ? <details className="analysis-card"><summary><b>{label}</b></summary><pre className="analysis-json">{JSON.stringify(value, null, 2)}</pre></details> : null;
}

function Review({ job, project, service, busy, answer, pipeline, resume }: { job: AnalysisDto; project: Project; service: Service; busy: boolean; answer: (answers: ReturnType<typeof reviewAnswers>) => Promise<boolean>; pipeline?: PipelineDto; resume?: (answers: PipelineAnswers) => Promise<boolean> }) {
  const { refreshService } = useProjects();
  const [draft, setDraft] = useState(() => {
    const initial = initialReviewDraft(service.remote, job);
    const candidate = job.analysisResult?.services.find((entry) => entry.serviceId === initial.candidateId);
    const advice = candidate ? candidateBuildAdvice(job, candidate) : {};
    return pipeline && candidate ? fillEmptyRecommendations(initial, candidate, advice.builder ?? 'railpack', advice.dockerfilePath) : initial;
  });
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<PipelineVariableDraft[]>(() => initialPipelineVariables(pipeline?.questions ?? []));
  const sourceReviewRequired = !!pipeline?.questions.some((question) => question.kind === 'code_review');
  const candidates = job.analysisResult?.services ?? [];
  const selected = candidates.find((candidate) => candidate.serviceId === draft.candidateId);
  const advice = selected ? candidateBuildAdvice(job, selected) : {};
  const changeVariable = (index: number, key: keyof PipelineVariableDraft, value: string) => {
    setVariables((old) => old.map((item, i) => i === index ? { ...item, [key]: value } : item)); setConfirmed(false); setMessage(null);
  };
  const change = (field: keyof AnalysisReviewDraft, value: string) => {
    setDraft((old) => ({ ...old, [field]: value })); setConfirmed(false); setMessage(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed || saving || busy || sourceReviewRequired) return;
    setSaving(true); setMessage(null);
    try {
      const reviewed = reviewAnswers(job, draft);
      const { analysisId: _analysisId, ...answers } = reviewed;
      if (await (pipeline && resume ? resume({ ...answers, variables: pipelineVariables(variables) }) : answer(reviewed))) {
        setConfirmed(false);
        setMessage(pipeline ? 'Input accepted. The analyzer will generate a plan, then build and deploy.' : 'Reviewed settings saved. Start Analyze & deploy to generate a plan and deploy.');
        try { await refreshService(project.id, service.id); }
        catch (e) { setMessage(`Settings saved, but the service view could not refresh. ${describeError(e)}`); }
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Check the settings.'); }
    finally { setSaving(false); }
  };

  if (job.confirmedAt && !pipeline) return <section className="analysis-card analysis-review"><div className="analysis-card-body"><h3>Build settings saved</h3><p className="analysis-notice success"><CircleCheck size={16} /> Settings for {job.selectedServiceCandidateId} were saved after review.</p><p className="analysis-muted">Outstanding source questions remain visible below. Start Analyze & deploy to generate a plan from the current source.</p><Link className="btn btn-outline" to={`/project/${project.id}/service/${service.id}`}>Open Deployments</Link></div></section>;

  return <section className="analysis-card analysis-review">
    <div className="analysis-card-body"><h3>{pipeline ? 'Complete the missing information' : 'Review build settings'}</h3><p className="analysis-muted">{pipeline ? 'Confirm the selected service and execution settings to continue planning, building and deploying this commit.' : 'Choose one deployed service and confirm its settings. Existing configuration is shown first. Saving settings does not start a deployment.'}</p>
      {sourceReviewRequired && <p className="analysis-notice">Source review is required before this workflow can proceed. Inspect the questions and evidence, update the source when needed, then cancel this run and start a new workflow.</p>}
      {!job.reviewRequired && <p className="analysis-notice success"><CircleCheck size={16} /> Settings from this analysis have been reviewed.</p>}
      <form onSubmit={(event) => void save(event)}>
        <label>Service candidate<select required value={draft.candidateId} disabled={busy || saving} onChange={(e) => change('candidateId', e.target.value)}><option value="">Choose a candidate</option>{candidates.map((candidate) => <option value={candidate.serviceId} key={candidate.serviceId}>{candidate.serviceId} · {displayAnalysisValue(candidate.root.value)}</option>)}</select></label>
        {selected && <p className="analysis-muted">Selected source root: <code>{displayAnalysisValue(selected.root.value)}</code> relative to the repository. Saving will set the service root directory to this path.</p>}
        <div className="analysis-review-actions"><span className="analysis-muted">Recommended builder: {advice.builder ?? 'Choose a service candidate'}</span><button type="button" className="btn btn-outline" disabled={!selected || busy || saving} onClick={() => {
          if (selected) { setDraft((old) => fillEmptyRecommendations(old, selected, advice.builder ?? (pipeline ? 'railpack' : undefined), advice.dockerfilePath)); setConfirmed(false); setMessage(null); }
        }}>Fill empty settings from analysis</button></div>
        <div className="analysis-form-grid">
          <label>Builder<select required value={draft.builder} disabled={busy || saving} onChange={(e) => change('builder', e.target.value)}><option value="">Choose a builder</option><option value="dockerfile">Dockerfile</option><option value="railpack">Railpack</option></select></label>
          <label>Container port<input type="number" min={1} max={65535} step={1} placeholder="e.g. 8080" value={draft.port} disabled={busy || saving} onChange={(e) => change('port', e.target.value)} /></label>
        </div>
        {draft.builder === 'dockerfile' && <label>Dockerfile path (relative to selected service root)<input required placeholder="Dockerfile" value={draft.dockerfilePath} disabled={busy || saving} onChange={(e) => change('dockerfilePath', e.target.value)} /></label>}
        <label>Build command<input placeholder="Use the builder default" value={draft.buildCommand} disabled={busy || saving} onChange={(e) => change('buildCommand', e.target.value)} /></label>
        <label>Start command<input placeholder="Use the builder default" value={draft.startCommand} disabled={busy || saving} onChange={(e) => change('startCommand', e.target.value)} /></label>
        {pipeline && <fieldset className="pipeline-variables"><legend>Environment bindings</legend><p className="analysis-muted">Use an existing Kubernetes Secret in the service namespace for sensitive values. Ask the infrastructure operator to provision it first. Only use public values for non-sensitive configuration.</p>{variables.map((variable, index) => <div className="pipeline-variable" key={index}><div className="analysis-form-grid"><label>Environment key<input required maxLength={128} value={variable.key} disabled={busy || saving} onChange={(e) => changeVariable(index, 'key', e.target.value)} /></label><label>Binding type<select value={variable.mode} disabled={busy || saving} onChange={(e) => changeVariable(index, 'mode', e.target.value)}><option value="secret">Existing Secret reference</option><option value="public">Public value</option></select></label></div>{variable.mode === 'secret' ? <div className="analysis-form-grid"><label>Existing Secret name<input required autoComplete="off" maxLength={253} placeholder="service-credentials" value={variable.secretRef} disabled={busy || saving} onChange={(e) => changeVariable(index, 'secretRef', e.target.value)} /></label><label>Key inside the Secret<input required autoComplete="off" maxLength={253} value={variable.secretKey} disabled={busy || saving} onChange={(e) => changeVariable(index, 'secretKey', e.target.value)} /></label></div> : <label>Public value<input required autoComplete="off" maxLength={2048} placeholder="Public configuration only" value={variable.value} disabled={busy || saving} onChange={(e) => changeVariable(index, 'value', e.target.value)} /></label>}<button type="button" className="btn btn-ghost" disabled={busy || saving} onClick={() => { setVariables((old) => old.filter((_, i) => i !== index)); setConfirmed(false); }}>Remove binding</button></div>)}<button type="button" className="btn btn-outline" disabled={busy || saving} onClick={() => { setVariables((old) => [...old, { key: '', mode: 'secret', value: '', secretRef: '', secretKey: '' }]); setConfirmed(false); }}>Add environment binding</button></fieldset>}
        <p className="analysis-muted">Empty port or command fields keep existing saved settings. {pipeline ? 'Required environment bindings are checked before a deployment plan is generated.' : 'Review environment key requirements below; secret values must be configured through your deployment environment.'}</p>
        <label className="analysis-confirm"><input type="checkbox" checked={confirmed} disabled={busy || saving || !selected || !draft.builder} onChange={(e) => setConfirmed(e.target.checked)} />I have reviewed the selected source root, builder, port and commands.</label>
        <div className="analysis-review-actions"><button type="submit" className="btn btn-primary" disabled={!confirmed || busy || saving || !selected || !draft.builder || sourceReviewRequired}>{saving ? 'Saving…' : pipeline ? 'Continue to planning & deploy' : 'Save reviewed settings'}</button><Link className="btn btn-outline" to={`/project/${project.id}/service/${service.id}`}>Open Deployments</Link></div>
        {message && <p className="analysis-notice" role="status">{message}</p>}
      </form>
    </div>
  </section>;
}

function Workflow({ job, project, service }: { job: PipelineDto; project: Project; service: Service }) {
  const paused = job.status === 'AWAITING_INPUT';
  const active = ['QUEUED', 'ANALYZING', 'PLANNING', 'BUILDING', 'DEPLOYING'].includes(job.status);
  return <section className="analysis-card analysis-progress pipeline-progress" aria-live="polite">
    <div className="analysis-field-title">{active ? <LoaderCircle size={18} className="analysis-spinner" /> : job.status === 'SUCCEEDED' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}<b>{job.stage === 'plan_ready' ? 'Deployment plan ready' : pipelineLabel[job.status]}</b><span className="analysis-muted">{job.stage}</span></div>
    <ol className="pipeline-steps" aria-label="Deployment workflow">{pipelineSteps(job).map((step, index) => <li key={step.label} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}><span>{step.state === 'complete' ? <CircleCheck size={15} /> : index + 1}</span>{step.label}</li>)}</ol>
    <p className="analysis-muted">Commit <code>{job.sourceSha || 'Resolving…'}</code> · Updated {new Date(job.updatedAt).toLocaleString()}</p>
    {job.stage === 'pending_init' && <p className="analysis-muted">Preparing the source snapshot. Progress will resume when the worker finishes initialization.</p>}
    {paused && <><p className="analysis-notice">The workflow is waiting for information. Review the questions and provide the missing settings below.</p><ul className="analysis-questions">{(job.questions ?? []).map((question, index) => <li key={`${question.key}-${index}`}><div className="analysis-field-title"><code>{question.key}</code><span className="analysis-badge unknown">{question.kind === 'code_review' ? 'Source review' : 'Configuration'}</span></div><p>{question.reason}</p></li>)}</ul></>}
    {job.status === 'FAILED' && <p className="analysis-notice error">{pipelineFailureMessage(job.errorCode)}{job.errorCode && <code>{job.errorCode}</code>}</p>}
    {job.status === 'CANCELLED' && <p className="analysis-muted">The workflow was cancelled. Any deployment already submitted keeps its own status.</p>}
    {job.planDigest && <p className="analysis-muted">Plan digest <code>{job.planDigest}</code></p>}
    {job.deploymentRequestId && <p><Link className="btn btn-outline" to={`/project/${project.id}/service/${service.id}/deployment/${job.deploymentRequestId}`}>Open deployment & logs</Link></p>}
  </section>;
}

function ExecutionPlan({ job }: { job: PipelineDto }) {
  const plan = job.executionPlan;
  const configValue = plan?.buildConfig;
  const config = configValue && typeof configValue === 'object' && !Array.isArray(configValue) ? configValue : undefined;
  return plan ? <section className="analysis-card"><div className="analysis-card-body"><h3>Build & deployment plan</h3><p className="analysis-muted">The analyzer's plan is bound to this commit and the selected deployment targets. Image build and deployment run through the platform workers.</p><dl className="analysis-identity"><dt>Application</dt><dd>{displayAnalysisValue(plan.selectedServiceCandidateId)}</dd><dt>Builder</dt><dd>{displayAnalysisValue(config?.builder)}</dd><dt>Source root</dt><dd>{displayAnalysisValue(config?.root_directory)}</dd><dt>Container port</dt><dd>{displayAnalysisValue(config?.port)}</dd><dt>Build command</dt><dd>{config?.build_command ? displayAnalysisValue(config.build_command) : 'Builder default'}</dd><dt>Start command</dt><dd>{config?.start_command ? displayAnalysisValue(config.start_command) : 'Image / builder default'}</dd></dl><p className="analysis-muted">Environment bindings appear as public configuration or Secret references. Secret contents are supplied by the deployment environment.</p></div><Artifact label="Worker plan details" value={plan} /></section> : null;
}

export function ServiceAnalysis({ project, service }: { project: Project; service: Service }) {
  const { job, active, loading, busy, error, reload, start, cancel, answer } = useAnalysis(service.id);
  const pipeline = usePipeline(service.id);
  const { refreshService } = useProjects();
  const [mode, setMode] = useState<AnalysisMode>('opencode');
  useEffect(() => {
    if (pipeline.job?.mode) setMode(pipeline.job.mode);
  }, [pipeline.job?.id, pipeline.job?.mode]);
  // The analysis may finish while this page is watching the enclosing workflow.
  useEffect(() => {
    if (pipeline.job?.analysisId) void reload();
  }, [pipeline.job?.analysisId, pipeline.job?.status, pipeline.job?.updatedAt, reload]);
  useEffect(() => {
    if (pipeline.job && ['BUILDING', 'DEPLOYING', 'SUCCEEDED'].includes(pipeline.job.status)) void refreshService(project.id, service.id).catch(() => undefined);
  }, [pipeline.job?.status, project.id, service.id, refreshService]);
  const workflowJob = pipeline.job;
  const workflowAnalysis = workflowJob?.analysisId === job?.id;
  const blocked = active || busy || pipeline.open || pipeline.busy || pipeline.loading;
  const result = job?.analysisResult;
  const analysisStatus = job?.analysisStatus ?? result?.status;
  const evidence = job?.evidence ?? [];
  return <div className="analysis">
    <header className="analysis-header"><div><h2>Analyze & deploy</h2><p className="analysis-muted">Analyze source evidence, resolve missing information and generate a deployment plan before building and deploying.</p></div><button type="button" className="btn btn-outline btn-icon-only" aria-label="Refresh workflow and analysis" disabled={loading || busy || pipeline.busy} onClick={() => { void reload(); void pipeline.reload(); }}><RotateCw size={16} /></button></header>
    <div className="analysis-toolbar"><label>Analysis mode<select value={mode} disabled={blocked} onChange={(e) => setMode(e.target.value as AnalysisMode)}><option value="opencode">AI analysis (OpenCode)</option><option value="static">Static analysis</option></select></label><button type="button" className="btn btn-primary" disabled={blocked || loading} onClick={() => void pipeline.start(mode)}>{pipeline.busy ? 'Submitting…' : 'Analyze & deploy'}</button><button type="button" className="btn btn-outline" disabled={blocked || loading} onClick={() => void start(mode)}>Analyze only</button>{pipeline.open ? <button type="button" className="btn btn-outline" disabled={pipeline.busy || workflowJob?.status === 'BUILDING' || workflowJob?.status === 'DEPLOYING'} title={workflowJob?.status === 'BUILDING' || workflowJob?.status === 'DEPLOYING' ? 'Build and deployment already started. Executor cancellation is not available.' : undefined} onClick={() => void pipeline.cancel()}><Square size={14} /> Cancel workflow</button> : active && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void cancel()}><Square size={14} /> Cancel analysis</button>}</div>
    <p className="analysis-muted">Analyze & deploy starts a workflow for a fixed commit and the selected targets, and enables this workflow on future branch pushes. It pauses when information is missing. Analyze only inspects source without deploying. Static analysis runs without model credentials.</p>
    {pipeline.error && <p className="analysis-notice error" role="alert"><TriangleAlert size={16} />{pipeline.error}</p>}
    {workflowJob && <Workflow job={workflowJob} project={project} service={service} />}
    {workflowJob && <ExecutionPlan job={workflowJob} />}
    <Artifact label="Analyzer planning report" value={workflowJob?.planningReport} />{workflowJob?.deploymentDossier && <><p className="analysis-muted">The portable infrastructure dossier may list bindings that need verification for new infrastructure. Deployment to the existing selected targets follows the worker plan above.</p><Artifact label="Portable infrastructure planning dossier" value={workflowJob.deploymentDossier} /></>}
    {error && <p className="analysis-notice error" role="alert"><TriangleAlert size={16} />{error}</p>}
    {loading && !job && <p className="analysis-muted" role="status">Loading analysis…</p>}
    {!loading && !job && !error && <div className="analysis-empty"><FileSearch size={32} /><h3>No analysis yet</h3><p className="analysis-muted">Analyze this repository to see service candidates, build settings, source evidence and questions.</p></div>}
    {job && <>
      <div className="analysis-card analysis-progress" role="status"><div className="analysis-field-title">{active ? <LoaderCircle size={18} className="analysis-spinner" /> : job.status === 'SUCCEEDED' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}<b>{statusLabel[job.status]}</b><span className="analysis-muted">{job.stage}</span></div>{analysisStatus && <p>{analysisLabel[analysisStatus]}</p>}<p className="analysis-muted">Commit <code>{job.sourceSha || 'Resolving…'}</code> · Updated {new Date(job.updatedAt).toLocaleString()}</p>{job.rootDirectory && <p className="analysis-muted">Requested source root: <code>{job.rootDirectory}</code></p>}{job.status === 'FAILED' && <p className="analysis-notice error">{executionError(job.errorCode)}{job.errorCode && <code>{job.errorCode}</code>}</p>}{job.status === 'CANCELLED' && <p className="analysis-muted">This run was cancelled. Start a new analysis when ready.</p>}</div>
      {result && <>
        <div className="analysis-legend"><span className="analysis-badge detected">detected</span><span>Observed in source</span><span className="analysis-badge suggested">suggested</span><span>Requires review</span><span className="analysis-badge unknown">unknown</span><span>Unresolved</span></div>
        {result.services.map((candidate) => <Candidate key={candidate.serviceId} candidate={candidate} evidence={evidence} />)}
        {job.status === 'SUCCEEDED' && analysisStatus !== 'unsupported' && result.services.length > 0 && (!workflowAnalysis || workflowJob?.status === 'AWAITING_INPUT') && <Review key={`${job.id}-${workflowJob?.id ?? 'review'}`} job={job} project={project} service={service} busy={busy || pipeline.busy} answer={answer} pipeline={workflowAnalysis && workflowJob?.status === 'AWAITING_INPUT' ? workflowJob : undefined} resume={pipeline.answer} />}
        <section className="analysis-card"><div className="analysis-card-body"><h3>Questions & coverage</h3>{result.questions.length === 0 ? <p className="analysis-muted">No outstanding analysis questions.</p> : <ul className="analysis-questions">{result.questions.map((question, index) => <li key={`${question.key}-${index}`}><div className="analysis-field-title"><code>{question.key}</code><span className="analysis-badge unknown">{question.kind === 'user_configuration' ? 'Configuration' : 'Code review'}</span></div><p>{question.reason}</p></li>)}</ul>}<p className="analysis-muted">{result.coverage.completeForProfile ? 'Source coverage is complete for this analysis profile.' : 'Source coverage has gaps that need review.'}</p>{result.coverage.limitations.map((limitation, index) => <p className="analysis-muted" key={index}>{limitation}</p>)}<p className="analysis-muted">Required environment keys are shown without asking for secret values.</p></div></section>
        {([['Environment keys', result.environmentKeys], ['Dependencies', result.dependencies], ['API routes', result.apiRoutes], ['Connections', result.connections]] as const).map(([label, fields]) => fields.length > 0 && <details className="analysis-card" key={label}><summary><b>{label}</b><span className="analysis-muted">{fields.length}</span></summary><div className="analysis-fields">{fields.map((field, index) => <Field key={index} label={label} field={field} evidence={evidence} />)}</div></details>)}
        <Verification decisions={job.verificationReport?.decisions ?? []} evidence={evidence} />
        {job.verificationReport?.reviewFindings?.length ? <details className="analysis-card"><summary><b>Verification review findings</b></summary><ul className="analysis-questions analysis-card-body">{job.verificationReport.reviewFindings.map((finding, index) => <li key={index}><code>{finding.key ?? finding.fieldPath ?? finding.reasonCode ?? 'Review finding'}</code><p>{finding.reason}</p><p className="analysis-muted">{finding.origin}</p></li>)}</ul></details> : null}
        <Artifact label="Source readiness" value={job.sourceReadiness} /><Artifact label="Initial analysis planning dossier" value={job.deploymentDossier} /><Artifact label="Analysis run report" value={job.runReport} />
        <details className="analysis-card"><summary><b>Source identity</b></summary><dl className="analysis-identity analysis-card-body"><dt>Snapshot</dt><dd>{job.sourceSnapshotId ?? result.sourceSnapshotId}</dd><dt>Context hash</dt><dd>{job.contextHash ?? result.contextHash}</dd><dt>Result digest</dt><dd>{job.resultDigest ?? 'Not provided'}</dd></dl></details>
        <p className="analysis-muted">Analyze only does not start deployment. Analyze & deploy authorizes this workflow to generate a plan and use Dockerfile or Railpack after required information is resolved.</p>
      </>}
    </>}
  </div>;
}

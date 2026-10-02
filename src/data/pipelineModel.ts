import type { PipelineDto, PipelineStatus } from '../lib/pipelineApi';

export const pipelineLabel: Record<PipelineStatus, string> = {
  QUEUED: 'Workflow queued', ANALYZING: 'Analyzing repository', AWAITING_INPUT: 'Your input is needed', PLANNING: 'Generating deployment plan',
  BUILDING: 'Building image', DEPLOYING: 'Deploying service', SUCCEEDED: 'Deployment completed', FAILED: 'Workflow stopped', CANCELLED: 'Workflow cancelled',
};
const steps = [
  { label: 'Analyze', statuses: ['QUEUED', 'ANALYZING'] }, { label: 'Confirm', statuses: ['AWAITING_INPUT'] },
  { label: 'Plan', statuses: ['PLANNING'] }, { label: 'Build', statuses: ['BUILDING'] }, { label: 'Deploy', statuses: ['DEPLOYING'] },
];
export function pipelineSteps(job: PipelineDto) {
  const planOnly = job.status === 'SUCCEEDED' && job.stage === 'plan_ready';
  const index = planOnly ? 3 : job.status === 'SUCCEEDED' ? steps.length : steps.findIndex((step) => step.statuses.includes(job.status));
  // Terminal failures do not imply that later steps were completed.
  const stage = job.stage.toUpperCase();
  const failedIndex = /DEPLOY/.test(stage) ? 4 : /BUILD/.test(stage) ? 3 : /PLAN/.test(stage) ? 2 : /INPUT|REVIEW/.test(stage) ? 1 : /ANALY|QUEUED/.test(stage) ? 0 : -1;
  const current = index < 0 ? failedIndex : index;
  return steps.map((step, i) => ({ ...step, state: i < current ? 'complete' : i === current && !planOnly ? (job.status === 'FAILED' || job.status === 'CANCELLED' ? 'stopped' : 'current') : 'pending' }));
}

export function pipelineFailureMessage(code?: string): string {
  if (code === 'MODEL_NOT_CONFIGURED') return 'The AI model is not configured. Choose Static analysis or ask the operator to configure the model.';
  if (code === 'ANALYSIS_STALE' || code === 'PIPELINE_STALE') return 'Source or settings changed. Start a new workflow so the analysis and plan use the same commit.';
  if (code === 'PLAN_BLOCKED' || code === 'EXECUTABLE_PLAN_BLOCKED') return 'The analyzer could not create an executable plan. Review the source questions and required configuration.';
  if (code === 'BUILD_FAILED' || code === 'DEPLOY_FAILED') return 'The deployment failed. Open the deployment to inspect the failure and diagnose its logs.';
  return 'This workflow could not continue. Review the stage and error code. Operator configuration or unresolved source information may need attention.';
}

import type { AnalysisAnswers, AnalysisCandidate, AnalysisDto, JsonValue } from '../lib/analysisApi';
import type { Builder, ServiceDto } from '../lib/endpoints';

export type AnalysisReviewDraft = {
  candidateId: string;
  builder: Builder | '';
  dockerfilePath: string;
  port: string;
  buildCommand: string;
  startCommand: string;
};
export const displayAnalysisValue = (value: JsonValue | undefined): string =>
  value === null || value === undefined ? 'Unknown' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function candidateBuildAdvice(job: AnalysisDto, candidate: AnalysisCandidate): { builder?: Builder; dockerfilePath?: string } {
  const root = candidate.root.value;
  if (typeof root !== 'string') return {};
  const targets = job.sourceReadiness?.buildTargets;
  const paths = new Set<string>();
  if (Array.isArray(targets)) for (const target of targets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) continue;
    if (target.contextPath !== root || typeof target.dockerfilePath !== 'string') continue;
    const path = root === '.' ? target.dockerfilePath : target.dockerfilePath.startsWith(`${root}/`) ? target.dockerfilePath.slice(root.length + 1) : undefined;
    if (path) paths.add(path);
  }
  if (paths.size === 1) return { builder: 'dockerfile', dockerfilePath: [...paths][0] };
  if (paths.size > 1) return { builder: 'dockerfile' };
  return root === (job.rootDirectory ?? '.') ? { builder: job.builderRecommendation } : {};
}

/** Existing user configuration takes precedence over analysis recommendations. */
export function initialReviewDraft(service: ServiceDto | undefined, job: AnalysisDto): AnalysisReviewDraft {
  const candidates = job.analysisResult?.services ?? [];
  const root = !service?.rootDirectory || service.rootDirectory === '/' ? '.' : service.rootDirectory;
  const matching = candidates.filter((candidate) => candidate.root.value === root);
  const selected = matching.length === 1 ? matching[0] : (candidates.length === 1 ? candidates[0] : undefined);
  return {
    candidateId: selected?.serviceId ?? '',
    builder: service?.builder ?? '',
    dockerfilePath: service?.dockerfilePath ?? '',
    port: service?.port === undefined ? '' : String(service.port),
    buildCommand: service?.buildCommand ?? '',
    startCommand: service?.startCommand ?? '',
  };
}

/** Called only by the explicit recommendation button; never overwrites a draft. */
export function fillEmptyRecommendations(draft: AnalysisReviewDraft, candidate: AnalysisCandidate, builder?: Builder, dockerfilePath?: string): AnalysisReviewDraft {
  const port = candidate.ports.find((field) => field.scope === 'container' && field.status !== 'unknown' && typeof field.value === 'number');
  const command = (value: JsonValue) => typeof value === 'string' && value !== 'none' ? value : '';
  return {
    ...draft,
    builder: draft.builder || builder || '',
    dockerfilePath: draft.dockerfilePath || dockerfilePath || '',
    port: draft.port || (port ? String(port.value) : ''),
    buildCommand: draft.buildCommand || command(candidate.buildCommand.value),
    startCommand: draft.startCommand || command(candidate.startCommand.value),
  };
}

export function reviewAnswers(job: AnalysisDto, draft: AnalysisReviewDraft): AnalysisAnswers {
  if (job.status !== 'SUCCEEDED' || (job.analysisStatus ?? job.analysisResult?.status) === 'unsupported') throw new Error('A supported, completed analysis is required.');
  if (!job.analysisResult?.services.some((candidate) => candidate.serviceId === draft.candidateId)) throw new Error('Select a service candidate.');
  if (!draft.builder) throw new Error('Choose a builder.');
  if (draft.builder === 'dockerfile' && !draft.dockerfilePath.trim()) throw new Error('Enter the Dockerfile path relative to the selected service root.');
  const port = draft.port.trim() ? Number(draft.port) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Port must be an integer between 1 and 65535.');
  return {
    analysisId: job.id,
    serviceCandidateId: draft.candidateId,
    builder: draft.builder,
    ...(draft.builder === 'dockerfile' && { dockerfilePath: draft.dockerfilePath.trim() }),
    ...(port !== undefined && { port }),
    ...(draft.buildCommand.trim() && { buildCommand: draft.buildCommand.trim() }),
    ...(draft.startCommand.trim() && { startCommand: draft.startCommand.trim() }),
  };
}

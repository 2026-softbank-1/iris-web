import { request } from './api';
import type { AnalysisMode, JsonValue } from './analysisApi';
import type { Builder } from './endpoints';

export type PipelineStatus = 'QUEUED' | 'ANALYZING' | 'AWAITING_INPUT' | 'PLANNING' | 'BUILDING' | 'DEPLOYING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type PipelineQuestion = { key: string; reason: string; kind: 'code_review' | 'user_configuration' };
export type PipelineDto = {
  id: string;
  serviceId: number | string;
  status: PipelineStatus;
  stage: string;
  mode?: AnalysisMode;
  autoDeploy: boolean;
  enableAutoDeploy: boolean;
  analysisId?: string;
  sourceSha?: string;
  deploymentRequestId?: number | string;
  planDigest?: string;
  executionPlan?: Record<string, JsonValue>;
  planningReport?: Record<string, JsonValue>;
  deploymentDossier?: Record<string, JsonValue>;
  questions: PipelineQuestion[];
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};
export type PipelineAnswers = {
  serviceCandidateId?: string;
  builder?: Builder;
  dockerfilePath?: string;
  port?: number;
  buildCommand?: string;
  startCommand?: string;
  variables?: { key: string; value?: string; secretRef?: string; secretKey?: string }[];
};

export const isPipelineActive = (status: PipelineStatus) => ['QUEUED', 'ANALYZING', 'PLANNING', 'BUILDING', 'DEPLOYING'].includes(status);
export const isPipelineOpen = (status: PipelineStatus) => isPipelineActive(status) || status === 'AWAITING_INPUT';
export const startPipeline = (serviceId: number | string, mode: AnalysisMode) =>
  request<PipelineDto>(`/services/${serviceId}/pipelines`, { method: 'POST', json: { mode, autoDeploy: true, enableAutoDeploy: true }, headers: { 'Idempotency-Key': crypto.randomUUID() } });
export const getPipeline = (serviceId: number | string) => request<PipelineDto>(`/services/${serviceId}/pipelines`);
export const answerPipeline = (serviceId: number | string, pipelineId: string, json: PipelineAnswers) =>
  request<PipelineDto>(`/services/${serviceId}/pipelines/${pipelineId}/answers`, { method: 'POST', json });
export const cancelPipeline = (serviceId: number | string, pipelineId: string) =>
  request<PipelineDto>(`/services/${serviceId}/pipelines/${pipelineId}/cancel`, { method: 'POST' });

import { request } from './api';
import type { Builder } from './endpoints';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type AnalysisField = {
  value: JsonValue;
  status: 'detected' | 'suggested' | 'unknown';
  scope: string;
  evidenceIds: string[];
  reason: string;
};
export type AnalysisCandidate = {
  serviceId: string;
  root: AnalysisField;
  role: AnalysisField;
  runtime: AnalysisField;
  buildCommand: AnalysisField;
  startCommand: AnalysisField;
  outputDirectory: AnalysisField;
  workingDirectory?: AnalysisField;
  ports: AnalysisField[];
  healthchecks: AnalysisField[];
  componentRoots: string[];
};
export type AnalysisStatus = 'complete' | 'needs_input' | 'unsupported';
export type AnalysisResult = {
  schemaVersion: '1';
  status: AnalysisStatus;
  sourceSnapshotId: string;
  contextHash: string;
  services: AnalysisCandidate[];
  dependencies: AnalysisField[];
  apiRoutes: AnalysisField[];
  environmentKeys: AnalysisField[];
  connections: AnalysisField[];
  questions: { key: string; reason: string; kind: 'code_review' | 'user_configuration' }[];
  coverage: { completeForProfile: boolean; limitations: string[] };
};
export type VerificationLocator = { path: string; startLine: number; endLine: number; sourceDigest?: string };
export type AnalysisEvidence = VerificationLocator & { evidenceId: string; redacted?: boolean; text?: string };
export type VerificationDecision = {
  fieldPath: (string | number)[];
  decision: 'supported' | 'rejected' | 'deferred';
  reasonCode: string;
  reason: string;
  evidenceIds: string[];
  inspectedPaths?: string[];
  supportingLocators?: VerificationLocator[];
  missingObligations?: string[];
};
export type VerificationReport = {
  schemaVersion?: string;
  resultDigest?: string;
  decisions?: VerificationDecision[];
  reviewFindings?: { key?: string; kind?: string; reason?: string; origin?: string; fieldPath?: string; reasonCode?: string }[];
};
export type AnalysisMode = 'opencode' | 'static';
export type AnalysisJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type AnalysisDto = {
  id: string;
  serviceId: number;
  mode?: AnalysisMode;
  status: AnalysisJobStatus;
  stage: string;
  sourceSha: string;
  sourceRepositoryUrl?: string;
  sourceBranch?: string;
  rootDirectory?: string;
  sourceSnapshotId?: string;
  contextHash?: string;
  resultDigest?: string;
  analysisStatus?: AnalysisStatus;
  analysisResult?: AnalysisResult;
  verificationReport?: VerificationReport;
  evidence?: AnalysisEvidence[];
  sourceReadiness?: Record<string, JsonValue>;
  deploymentDossier?: Record<string, JsonValue>;
  runReport?: Record<string, JsonValue>;
  builderRecommendation?: Builder;
  reviewRequired: boolean;
  deploymentAuthorized: false;
  errorCode?: string;
  confirmedAt?: string;
  selectedServiceCandidateId?: string;
  createdAt: string;
  updatedAt: string;
};
export type AnalysisAnswers = {
  analysisId: string;
  serviceCandidateId: string;
  builder: Builder;
  dockerfilePath?: string;
  port?: number;
  buildCommand?: string;
  startCommand?: string;
};

export const isAnalysisActive = (status: AnalysisJobStatus) => status === 'QUEUED' || status === 'RUNNING';
export const startAnalysis = (serviceId: number | string, mode: AnalysisMode) =>
  request<AnalysisDto>(`/services/${serviceId}/analysis`, { method: 'POST', json: { mode } });
export const getAnalysis = (serviceId: number | string) => request<AnalysisDto>(`/services/${serviceId}/analysis`);
export const cancelAnalysis = (serviceId: number | string, analysisId: string) =>
  request<AnalysisDto>(`/services/${serviceId}/analysis/cancel`, { method: 'POST', json: { analysisId } });
export const answerAnalysis = (serviceId: number | string, json: AnalysisAnswers) =>
  request<AnalysisDto>(`/services/${serviceId}/analysis/answers`, { method: 'POST', json });

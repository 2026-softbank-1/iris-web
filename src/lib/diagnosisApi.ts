import { request } from './api';

export type DiagnosisStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
export type DiagnosisEvidence = { id: string; source_id: string; chunk_id: string; stage: string; stream: string; chunk_line: number; source_line?: number | null; text: string };
export type RemediationPlan = {
  id: string; title: string; hypothesis_ids: string[]; evidence_ids: string[]; apply_when: string[];
  changes: { kind: string; target: string; target_known: boolean; instruction: string; language: string; snippet: string; placeholders: { name: string; description: string }[] }[];
  verification: { instruction: string; expected_result: string }[];
  rollback: string[]; risks: string[];
};
export type DiagnosisResult = {
  schema_version: string;
  analysis: {
    analysis_status: 'diagnosed' | 'insufficient_evidence' | 'no_failure_evidence';
    summary: string;
    observations: { id: string; kind: 'failure' | 'context'; text: string; evidence_ids: string[] }[];
    hypotheses: { id: string; category: string; support_level: string; statement: string; observation_ids: string[]; evidence_ids: string[]; counter_evidence_ids: string[]; uncertainty: string }[];
    next_checks: { id: string; target: string; method: string; purpose: string; hypothesis_ids: string[] }[];
    missing_information: { requested_data: string; reason: string }[];
    limitations: string[];
    remediation?: { status: 'proposed' | 'needs_more_evidence' | 'not_needed'; reason: string; plans: RemediationPlan[] };
  } | null;
  evidence: DiagnosisEvidence[];
  input_limitations: string[];
  remediation_execution?: string | { status: string };
};
export type DiagnosisDto = {
  id: string; serviceId: number; deploymentId: number; attemptId: string;
  status: DiagnosisStatus; stage: string; result?: DiagnosisResult | null; errorCode?: string | null;
  createdAt: string; updatedAt: string;
};

export const isDiagnosisActive = (status: DiagnosisStatus) => status === 'QUEUED' || status === 'RUNNING';
export const getDiagnosis = (serviceId: string, deploymentId: string) =>
  request<DiagnosisDto>(`/services/${serviceId}/deployments/${deploymentId}/diagnosis`);
export const startDiagnosis = (serviceId: string, deploymentId: string) =>
  request<DiagnosisDto>(`/services/${serviceId}/deployments/${deploymentId}/diagnosis`, { method: 'POST' });

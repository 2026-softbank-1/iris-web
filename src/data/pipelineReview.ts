import type { PipelineAnswers, PipelineQuestion } from '../lib/pipelineApi';

export type PipelineVariableDraft = { key: string; mode: 'secret' | 'public'; value: string; secretRef: string; secretKey: string };
const VARIABLE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECRET_KEY = /PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_KEY|DATABASE_URL/i;
export function initialPipelineVariables(questions: PipelineQuestion[]): PipelineVariableDraft[] {
  return [...new Set(questions.filter((question) => question.key.startsWith('variables.')).map((question) => question.key.slice('variables.'.length)))].map((key) => ({ key, mode: 'secret', value: '', secretRef: '', secretKey: key }));
}
export function pipelineVariables(drafts: PipelineVariableDraft[]): NonNullable<PipelineAnswers['variables']> {
  const seen = new Set<string>();
  return drafts.map((draft) => {
    const key = draft.key.trim();
    if (!VARIABLE_KEY.test(key) || key.length > 128) throw new Error('Environment key must contain up to 128 letters, digits and underscores, and cannot start with a digit.');
    if (seen.has(key)) throw new Error(`Environment key ${key} is listed more than once.`);
    seen.add(key);
    if (draft.mode === 'public') {
      if (SECRET_KEY.test(key)) throw new Error(`${key} must use an existing Secret reference.`);
      if (!draft.value.trim()) throw new Error(`Enter a public value for ${key}, or use a Secret reference.`);
      return { key, value: draft.value };
    }
    const secretRef = draft.secretRef.trim(), secretKey = draft.secretKey.trim();
    if (!secretRef || !secretKey) throw new Error(`Enter the existing Secret name and key for ${key}.`);
    if (secretRef.length > 253 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(secretRef)) throw new Error(`Secret name for ${key} must use lowercase letters, digits and hyphens.`);
    if (secretKey.length > 253 || !/^[A-Za-z0-9_.-]+$/.test(secretKey)) throw new Error(`Secret key for ${key} must use letters, digits, underscores, dots or hyphens.`);
    return { key, secretRef, secretKey };
  });
}

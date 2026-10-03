import type { DiagnosisDto } from '../lib/endpoints';

const variableName = /^[A-Z][A-Z0-9_]{0,127}$/;
/** Only names are returned. App defaults and variable values are never changed here. */
export function environmentVariableNames(diagnosis?: DiagnosisDto): string[] {
  const names = new Set<string>();
  for (const plan of diagnosis?.analysis?.remediation.plans ?? []) {
    for (const change of plan.changes ?? []) {
      if (change.kind === 'configuration' && variableName.test(change.target)) names.add(change.target);
    }
  }
  // Handles the concrete Zod missing-variable case even if no remediation plan was proposed.
  const evidence = (diagnosis?.evidence ?? []).map(e => e.text).join('\n');
  for (const match of evidence.matchAll(/["']path["']\s*:\s*\[\s*["']([A-Z][A-Z0-9_]{0,127})["']\s*\][\s\S]{0,250}?received undefined/g)) names.add(match[1]);
  return [...names].sort();
}
export const environmentVariablesUrl = (deploymentUrl: string) => deploymentUrl.replace(/\/deployment\/[^/]+.*$/, '/variables');


/** A successful diagnosis without an applicable code plan needs human remediation. */
export function requiresManualRepair(diagnosis?: DiagnosisDto): boolean {
  if (environmentVariableNames(diagnosis).length > 0) return true;
  if (diagnosis?.status !== 'SUCCEEDED') return false;
  return !(diagnosis.analysis?.remediation.plans ?? []).some(p =>
    (p.changes?.length ?? 0) > 0 && p.changes!.every(c => c.kind === 'code'));
}

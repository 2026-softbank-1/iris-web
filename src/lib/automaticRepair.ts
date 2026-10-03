import { ApiError } from './api';
import { getLatestRepair, getRepair, requestAutomaticRepair, resumeAutomaticRepair, type RepairDto } from './endpoints';

export const isAutomaticRepairPending = (r: RepairDto | null) => {
  if (r?.autoRedeploy && r.publication?.status === 'MERGED' && !r.publication.redeploymentId) return true;
  if (!r || (r.autoMerge && ['REDEPLOY_REQUESTED', 'MERGED', 'ERROR', 'SKIPPED'].includes(r.publication?.status ?? ''))) return false;
  return r.status === 'RUNNING' || r.status === 'UNKNOWN_OUTCOME' || (r.autoMerge && r.status !== 'FAILED');
};
/** Called only by an AI repair click. Reads and page loads never grant merge authorization. */
export async function triggerAutomaticRepair(serviceId: string, deploymentId: string, diagnosisId?: number) {
  const storageKey = `iris-auto-repair:${serviceId}:${deploymentId}:${diagnosisId ?? 'diagnose'}`;
  let latest;
  try {
    if (diagnosisId !== undefined) latest = await getLatestRepair(serviceId, deploymentId, diagnosisId);
    else { let id: string | null = null; try { id = sessionStorage.getItem(storageKey + ':id'); } catch { /* Optional storage. */ } if (id) latest = await getRepair(serviceId, Number(id)); }
  }
  catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  if (latest?.autoMerge && (isAutomaticRepairPending(latest) || latest.publication?.status === 'MERGED')) return latest;
  if (latest && latest.status !== 'FAILED') return resumeAutomaticRepair(serviceId, latest.id);
  let key: string | null = null;
  if (!latest) { try { key = sessionStorage.getItem(storageKey); } catch { /* Storage is optional. */ } }
  key ??= crypto.randomUUID();
  try { sessionStorage.setItem(storageKey, key); } catch { /* The server deduplicates this key. */ }
  const repair = await requestAutomaticRepair(serviceId, deploymentId, diagnosisId, key);
  try { sessionStorage.setItem(storageKey + ':id', String(repair.id)); } catch { /* Optional storage. */ }
  return repair;
}

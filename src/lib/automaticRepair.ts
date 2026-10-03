import { ApiError } from './api';
import { getLatestRepair, requestAutomaticRepair, resumeAutomaticRepair, type RepairDto } from './endpoints';

export const isAutomaticRepairPending = (r: RepairDto | null) => {
  if (!r || (r.autoMerge && ['MERGED', 'ERROR', 'SKIPPED'].includes(r.publication?.status ?? ''))) return false;
  return r.status === 'RUNNING' || r.status === 'UNKNOWN_OUTCOME' || (r.autoMerge && r.status !== 'FAILED');
};
/** Called only by an AI repair click. Reads and page loads never grant merge authorization. */
export async function triggerAutomaticRepair(serviceId: string, deploymentId: string, diagnosisId: number) {
  let latest;
  try { latest = await getLatestRepair(serviceId, deploymentId, diagnosisId); }
  catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  if (latest?.autoMerge && (isAutomaticRepairPending(latest) || latest.publication?.status === 'MERGED')) return latest;
  if (latest && latest.status !== 'FAILED') return resumeAutomaticRepair(serviceId, latest.id);
  const storageKey = `iris-auto-repair:${serviceId}:${deploymentId}:${diagnosisId}`;
  let key: string | null = null;
  if (!latest) { try { key = sessionStorage.getItem(storageKey); } catch { /* Storage is optional. */ } }
  key ??= crypto.randomUUID();
  try { sessionStorage.setItem(storageKey, key); } catch { /* The server deduplicates this key. */ }
  return requestAutomaticRepair(serviceId, deploymentId, diagnosisId, key);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/endpoints';
import { isStepActive } from './stackModel';

const POLL_MS = 3000;
const IDLE_POLL_MS = 10_000;

type Loaded = { projectId: string; stacks: api.StackDto[] };

/**
 * 프로젝트의 스택(한 레포 분석에서 나온 서비스 묶음). 스택 배포가 진행 중이면 3초마다, 아니면 10초마다 다시 받는다.
 * 스택 API 가 없는 서버(404)나 받지 못했을 때는 스택이 없는 것으로 보고 캔버스는 예전 배치 그대로 둔다.
 */
export function useStacks(projectId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const load = useCallback(async () => {
    try {
      const stacks = await api.listStacks(projectId);
      setLoaded({ projectId, stacks });
    } catch {
      setLoaded((prev) => prev ?? { projectId, stacks: [] });
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const current = loaded?.projectId === projectId ? loaded : null;
  const stacks = useMemo(() => current?.stacks ?? [], [current]);
  const active = stacks.some((s) => s.isDeploying || s.services.some((m) => isStepActive(m.status)));
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, active ? POLL_MS : IDLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, load]);

  /** 스택 전체(또는 serviceIds 만) 재배포. 거절(422 등)은 던진다. */
  const deploy = useCallback(async (stackId: number, serviceIds?: number[], skipVariableValidation = false) => {
    const next = await api.deployStack(projectId, stackId, { ...(serviceIds && { serviceIds }), ...(skipVariableValidation && { skipVariableValidation }) });
    setLoaded((prev) => ({ projectId, stacks: (prev?.projectId === projectId ? prev.stacks : []).map((s) => (s.id === next.id ? next : s)) }));
    void load();
  }, [projectId, load]);

  return { stacks, loading: !current, reload: load, deploy };
}

export type StacksApi = ReturnType<typeof useStacks>;

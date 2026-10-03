import { useCallback, useEffect, useMemo, useState } from 'react';
import { describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { CPU_STOPS, MEMORY_STOPS, cpuCores, draftOf, isDirty, memoryMiB, parseReplicas, stopsWith, toUpdate } from './scalingModel';

type Loaded = { serviceId: string; scaling?: api.ScalingDto; error?: string };

/**
 * 서비스의 Pod 수·Pod 별 CPU·메모리 설정과 그 편집 상태. 저장된 설정을 받아 화면에서 고치고, apply 로 한 번에 보낸다.
 * 적용은 Pod 이 새로 시작되는 RESTART 배포를 만드니 슬라이더를 움직일 때마다 보내지 않고 apply 를 눌러야 보낸다.
 */
export function useServiceScaling(serviceId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.getServiceScaling(serviceId, ctrl.signal).then(
      (scaling) => { if (!ctrl.signal.aborted) setLoaded({ serviceId, scaling }); },
      (e) => { if (!ctrl.signal.aborted) setLoaded({ serviceId, error: describeError(e) }); },
    );
    return () => ctrl.abort();
  }, [serviceId, attempt]);

  // 다른 서비스의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  const current = loaded?.serviceId === serviceId ? loaded : null;
  const scaling = current?.scaling;

  const [replicasText, setReplicasText] = useState('');
  const [cpu, setCpu] = useState('');
  const [memory, setMemory] = useState('');
  const [busy, setBusy] = useState(false);

  // 설정을 받거나 적용에 성공해 저장된 값이 바뀌면 편집 상태를 그 값으로 맞춘다.
  useEffect(() => {
    if (!scaling) return;
    const draft = draftOf(scaling);
    setReplicasText(String(draft.replicas));
    setCpu(draft.cpu);
    setMemory(draft.memory);
  }, [scaling]);

  const replicas = parseReplicas(replicasText);
  const stored = scaling?.resources.limits;
  const cpuStops = useMemo(() => stopsWith(CPU_STOPS, stored?.cpu, cpuCores), [stored?.cpu]);
  const memoryStops = useMemo(() => stopsWith(MEMORY_STOPS, stored?.memory, memoryMiB), [stored?.memory]);

  const valid = replicas !== null;
  const dirty = !!scaling && replicas !== null && isDirty(scaling, { replicas, cpu, memory });
  // 입력이 잘못된 채여도 되돌릴 수는 있어야 한다.
  const edited = dirty || (!!scaling && replicas === null);

  const reset = useCallback(() => {
    if (!scaling) return;
    const draft = draftOf(scaling);
    setReplicasText(String(draft.replicas));
    setCpu(draft.cpu);
    setMemory(draft.memory);
  }, [scaling]);

  /** 편집한 값을 보낸다. 접수되면 저장된 값을 응답으로 바꾸고, 실패하면 편집 상태를 그대로 둔 채 던진다. */
  const apply = useCallback(async () => {
    if (!scaling || replicas === null) throw new Error('Nothing to apply');
    setBusy(true);
    try {
      const dto = await api.updateServiceScaling(serviceId, toUpdate(scaling, { replicas, cpu, memory }), crypto.randomUUID());
      // 적용하는 사이 다른 서비스로 옮겼다면 그 서비스의 화면을 덮지 않는다.
      setLoaded((prev) => (prev && prev.serviceId !== serviceId ? prev : { serviceId, scaling: dto }));
      return dto;
    } finally {
      setBusy(false);
    }
  }, [serviceId, scaling, replicas, cpu, memory]);

  return {
    loading: !current,
    error: current?.error ?? null,
    retry: () => { setLoaded(null); setAttempt((n) => n + 1); },
    ready: !!scaling,
    replicasText, setReplicasText, replicas,
    cpu, setCpu, cpuStops,
    memory, setMemory, memoryStops,
    valid, dirty, edited, busy, reset, apply,
  };
}

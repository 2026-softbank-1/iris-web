// 서비스 Pod 수·Pod 별 CPU·메모리(was 의 scaling API)를 화면 값으로 바꾸는 계산. API 값은 Kubernetes 수량 문자열이다.
import type { ScalingDto, ScalingUpdate } from '../lib/endpoints';

export const MIN_REPLICAS = 0;
export const MAX_REPLICAS = 10;

/** 슬라이더의 한 칸. qty 가 서버에 보내는 수량 문자열이고 amount 는 비교용 숫자(CPU 는 vCPU, 메모리는 MiB)다. */
export type Stop = { qty: string; amount: number };

// 서버는 임의의 수량을 받지만 화면은 이 칸으로만 고르게 한다. 서버에 이미 다른 값이 저장돼 있으면 그 값을 칸으로 끼워 넣는다.
export const CPU_STOPS: Stop[] = [
  { qty: '250m', amount: 0.25 },
  { qty: '500m', amount: 0.5 },
  { qty: '1', amount: 1 },
  { qty: '2', amount: 2 },
  { qty: '4', amount: 4 },
];
export const MEMORY_STOPS: Stop[] = [
  { qty: '256Mi', amount: 256 },
  { qty: '512Mi', amount: 512 },
  { qty: '1Gi', amount: 1024 },
  { qty: '2Gi', amount: 2048 },
  { qty: '4Gi', amount: 4096 },
];

const MEMORY_FACTORS_MIB: Record<string, number> = {
  '': 1 / 1024 ** 2,
  Ki: 1 / 1024,
  Mi: 1,
  Gi: 1024,
  Ti: 1024 ** 2,
  Pi: 1024 ** 3,
  Ei: 1024 ** 4,
  k: 1000 / 1024 ** 2,
  M: 1000 ** 2 / 1024 ** 2,
  G: 1000 ** 3 / 1024 ** 2,
  T: 1000 ** 4 / 1024 ** 2,
  P: 1000 ** 5 / 1024 ** 2,
  E: 1000 ** 6 / 1024 ** 2,
};

/** CPU 수량을 vCPU 로. `"250m"` → 0.25, `"0.5"` → 0.5. 모르는 표기는 NaN. */
export function cpuCores(qty: string): number {
  return /^\d+m$/.test(qty) ? Number(qty.slice(0, -1)) / 1000 : /^(\d+\.?\d*|\.\d+)$/.test(qty) ? Number(qty) : NaN;
}

/** 메모리 수량을 MiB 로. `"1Gi"` → 1024, `"536870912"` → 512. 모르는 표기는 NaN. */
export function memoryMiB(qty: string): number {
  const m = /^(\d+\.?\d*|\.\d+)([KMGTPE]i|[kMGTPE])?$/.exec(qty);
  return m ? Number(m[1]) * MEMORY_FACTORS_MIB[m[2] ?? ''] : NaN;
}

const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** 기본 칸에 서버가 저장한 값(qty)을 합쳐 작은 순으로 돌려준다. 이미 같은 양의 칸이 있으면 그 칸을 쓴다. */
export function stopsWith(base: Stop[], qty: string | undefined, parse: (qty: string) => number): Stop[] {
  const amount = qty === undefined ? NaN : parse(qty);
  if (qty === undefined || Number.isNaN(amount) || base.some((s) => same(s.amount, amount))) return base;
  return [...base, { qty, amount }].sort((a, b) => a.amount - b.amount);
}

/** 슬라이더가 가리킬 칸의 위치. qty 와 같은 양의 칸이 없으면 가장 가까운 칸이다. */
export function stopIndex(stops: Stop[], qty: string | undefined, parse: (qty: string) => number): number {
  const amount = qty === undefined ? NaN : parse(qty);
  if (Number.isNaN(amount)) return 0;
  let best = 0;
  stops.forEach((s, i) => {
    if (Math.abs(s.amount - amount) < Math.abs(stops[best].amount - amount)) best = i;
  });
  return best;
}

const trim = (n: number) => String(Number(n.toFixed(2)));

/** 슬라이더 머리에 보여줄 값과 단위. */
export const cpuLabel = (cores: number) => ({ value: trim(cores), unit: 'vCPU' });
export const memoryLabel = (mib: number) => (mib >= 1024 ? { value: trim(mib / 1024), unit: 'GiB' } : { value: trim(mib), unit: 'MiB' });

/** 화면에서 고치는 값. cpu·memory 는 Pod 하나의 **limits** 수량이다. */
export type ScaleDraft = { replicas: number; cpu: string; memory: string };

export const draftOf = (scaling: ScalingDto): ScaleDraft => ({ replicas: scaling.replicas, cpu: scaling.resources.limits.cpu, memory: scaling.resources.limits.memory });

/** 입력 칸의 글자를 Pod 수로. 비었거나 범위를 벗어나면 null. */
export function parseReplicas(text: string): number | null {
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= MIN_REPLICAS && n <= MAX_REPLICAS ? n : null;
}

/** 저장된 설정과 같은 양이면 false. "1" 과 "1000m" 처럼 표기가 달라도 같은 양이면 같다고 본다. */
export function isDirty(scaling: ScalingDto, draft: ScaleDraft): boolean {
  const { limits } = scaling.resources;
  return draft.replicas !== scaling.replicas || !same(cpuCores(draft.cpu), cpuCores(limits.cpu)) || !same(memoryMiB(draft.memory), memoryMiB(limits.memory));
}

/**
 * 서버에 보낼 전체 설정. 화면은 limits 만 고치므로 requests 는 저장된 값을 그대로 두되, 새 limits 를 넘으면 limits 로 낮춘다
 * (서버가 requests > limits 를 거부한다). 바꾸지 않은 값은 저장된 문자열을 그대로 보낸다.
 */
export function toUpdate(scaling: ScalingDto, draft: ScaleDraft): ScalingUpdate {
  const { requests } = scaling.resources;
  return {
    replicas: draft.replicas,
    resources: {
      requests: {
        cpu: cpuCores(requests.cpu) > cpuCores(draft.cpu) ? draft.cpu : requests.cpu,
        memory: memoryMiB(requests.memory) > memoryMiB(draft.memory) ? draft.memory : requests.memory,
      },
      limits: { cpu: draft.cpu, memory: draft.memory },
    },
  };
}

// 프로젝트 캔버스의 스택 그룹 배치. 순수 함수만 둔다(화면은 ProjectCanvasPage 의 Canvas).
import type { StackDto, StackServiceDto, StackStepStatus } from '../lib/endpoints';
import type { Service } from './mock';

export const NODE_W = 288;
export const NODE_H = 144;
const COL_GAP = 48;
const ROW_GAP = 32;
export const GROUP_PAD = 24;
/** 그룹 머리말(레포·단계 진행·재배포 버튼). 변경 감지 배너가 있으면 BANNER_H 만큼 늘어난다. */
export const GROUP_HEAD = 96;
export const BANNER_H = 56;
const STACK_GAP = 48;

export type StackLayout = {
  stack: StackDto;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 스택에 속한 서비스 id → 위치(그룹 안쪽이 아니라 캔버스 좌표). */
  nodes: { serviceId: string; step: StackServiceDto; x: number; y: number }[];
  edges: { from: string; to: string; flowing: boolean }[];
};

const IN_PROGRESS: StackStepStatus[] = ['QUEUED', 'BUILDING', 'DEPLOYING'];
export const isStepActive = (status: StackStepStatus) => IN_PROGRESS.includes(status);

/** 배포 순서 단계(1 DB, 2 의존 대상이 있는 앱, 3 나머지)마다 서비스. */
export function phasesOf(stack: StackDto): { order: number; steps: StackServiceDto[] }[] {
  const orders = [...new Set(stack.services.map((s) => s.order))].sort((a, b) => a - b);
  return orders.map((order) => ({ order, steps: stack.services.filter((s) => s.order === order) }));
}

/** 단계의 대표 상태: 하나라도 실패면 실패, 진행 중이면 진행, 모두 성공이면 성공, 보류가 있으면 보류. */
export function phaseStatus(steps: StackServiceDto[]): 'failed' | 'active' | 'done' | 'held' | 'waiting' {
  if (steps.some((s) => s.status === 'FAILED' || s.status === 'MANUAL_INTERVENTION' || s.status === 'ROLLED_BACK')) return 'failed';
  if (steps.some((s) => isStepActive(s.status))) return 'active';
  if (steps.every((s) => s.status === 'SUCCEEDED')) return 'done';
  if (steps.some((s) => s.status === 'HELD')) return 'held';
  return 'waiting';
}

/**
 * 스택마다 그룹 상자를 세로로 쌓고, 상자 안에서는 배포 순서(order)가 열(왼쪽부터), 같은 단계 서비스는 행이다.
 * 스택에 속하지 않은 서비스는 맨 아래 한 줄로 둔다(스택이 없으면 예전 배치와 같다).
 */
export function layoutStacks(stacks: StackDto[], services: Service[], pending: Set<StackDto['id']> = new Set()): { layouts: StackLayout[]; loose: Service[]; looseY: number } {
  const byId = new Map(services.map((s) => [s.id, s]));
  const layouts: StackLayout[] = [];
  const placed = new Set<string>();
  let y = 0;
  for (const stack of stacks) {
    const members = stack.services.filter((m) => byId.has(String(m.serviceId)));
    if (members.length === 0) continue;
    const orders = [...new Set(members.map((m) => m.order))].sort((a, b) => a - b);
    const rowsInCol = new Map<number, number>();
    const head = GROUP_HEAD + (pending.has(stack.id) ? BANNER_H : 0);
    const nodes = members.map((step) => {
      const col = orders.indexOf(step.order);
      const row = rowsInCol.get(col) ?? 0;
      rowsInCol.set(col, row + 1);
      return { serviceId: String(step.serviceId), step, x: GROUP_PAD + col * (NODE_W + COL_GAP), y: y + head + row * (NODE_H + ROW_GAP) };
    });
    const maxRows = Math.max(...rowsInCol.values());
    const width = GROUP_PAD * 2 + orders.length * NODE_W + (orders.length - 1) * COL_GAP;
    const height = head + maxRows * NODE_H + (maxRows - 1) * ROW_GAP + GROUP_PAD;
    const unitToService = new Map(members.map((m) => [m.unitId, String(m.serviceId)]));
    const edges = members.flatMap((m) =>
      m.dependsOn.flatMap((unit) => {
        const to = unitToService.get(unit);
        if (!to) return [];
        const target = members.find((x) => String(x.serviceId) === to);
        return [{ from: String(m.serviceId), to, flowing: !!target && isStepActive(target.status) }];
      }),
    );
    members.forEach((m) => placed.add(String(m.serviceId)));
    layouts.push({ stack, x: 0, y, width, height, nodes, edges });
    y += height + STACK_GAP;
  }
  return { layouts, loose: services.filter((s) => !placed.has(s.id)), looseY: y };
}

/** 이 스택 서비스가 보류된 이유를 설명할 서비스 이름(heldBy 는 unitId 다). */
export function heldByName(stack: StackDto, step: StackServiceDto, services: Service[]): string | undefined {
  if (!step.heldBy) return undefined;
  const id = stack.services.find((s) => s.unitId === step.heldBy)?.serviceId;
  return services.find((s) => s.id === String(id))?.name ?? step.heldBy;
}

export const repoNameOf = (url: string) => url.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');

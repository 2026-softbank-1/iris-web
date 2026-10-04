import { type Node, type NodeProps } from '@xyflow/react';
import { ArrowRight, Check, CircleAlert, FolderGit2, GitCompare, Pause, RefreshCw } from 'lucide-react';
import { phaseStatus, phasesOf, repoNameOf } from '../../data/stackModel';
import type { Service } from '../../data/mock';
import { useI18n } from '../../i18n';
import type { StackDto } from '../../lib/endpoints';

export type StackGroupData = {
  stack: StackDto;
  services: Service[];
  deploying: boolean;
  busy: boolean;
  onDeploy: (stack: StackDto) => void;
  onShowChanges: (stack: StackDto) => void;
};
export type StackGroupNode = Node<StackGroupData, 'stack'>;

/**
 * 스택 그룹 상자: 레포 이름, 배포 순서(1 DB → 2 api/worker → 3 web)별 진행, "스택 전체 재배포", 레포 구성 변경 감지 배너.
 * 상자 자체는 클릭을 가로채지 않고(빈 곳은 캔버스로 전달), 머리말 안의 버튼만 받는다.
 */
export function StackGroup({ data }: NodeProps<StackGroupNode>) {
  const { stack, services, deploying, busy, onDeploy, onShowChanges } = data;
  const { t } = useI18n();
  const nameOf = (serviceId: number) => services.find((s) => s.id === String(serviceId))?.name ?? `#${serviceId}`;
  const phases = phasesOf(stack);
  const pending = stack.pendingChanges;
  return (
    <div className="stack-group" role="group" aria-label={t('stack.group.label', { repo: repoNameOf(stack.repositoryUrl) })}>
      <div className="stack-head nodrag nopan">
        <div className="stack-title">
          <FolderGit2 size={16} aria-hidden />
          <span className="stack-repo truncate">{repoNameOf(stack.repositoryUrl)}</span>
          <span className="gate-code">{stack.sourceBranch}</span>
          <span className="stack-count">{t('stack.group.count', { n: stack.services.length })}</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm stack-redeploy" disabled={deploying || busy} onClick={() => onDeploy(stack)}>
          <RefreshCw size={14} aria-hidden className={deploying ? 'spin' : undefined} />
          {t(deploying ? 'stack.group.deploying' : 'stack.group.redeploy')}
        </button>
      </div>
      <ol className="stack-phases nodrag nopan" aria-label={t('stack.group.order')}>
        {phases.map((phase, i) => {
          const status = phaseStatus(phase.steps);
          return (
            <li key={phase.order} className={`stack-phase ${status}`}>
              {i > 0 && <ArrowRight size={12} className="stack-phase-arrow" aria-hidden />}
              <span className="stack-phase-no">{status === 'done' ? <Check size={11} aria-hidden /> : status === 'failed' ? <CircleAlert size={11} aria-hidden /> : status === 'held' ? <Pause size={11} aria-hidden /> : phase.order}</span>
              <span className="stack-phase-names truncate">{phase.steps.map((s) => nameOf(s.serviceId)).join(', ')}</span>
              <span className="sr-only">{t(`stack.phase.${status}`)}</span>
            </li>
          );
        })}
      </ol>
      {pending && (
        <div className="stack-pending nodrag nopan" role="status">
          <GitCompare size={16} aria-hidden />
          <span>{t('stack.pending.banner', { n: pending.changes.length })}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onShowChanges(stack)}>{t('stack.pending.view')}</button>
        </div>
      )}
    </div>
  );
}

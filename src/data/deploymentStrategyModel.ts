// 서비스 배포 방식(롤링·카나리·블루그린)의 규칙과 화면 문구 키. 단계·대기 시간은 chart 가 고정한다.
import type { MessageKey } from '../i18n';
import { ApiError } from '../lib/api';
import type { DeploymentStrategy } from '../lib/endpoints';

export const DEPLOYMENT_STRATEGIES: DeploymentStrategy[] = ['ROLLING', 'CANARY', 'BLUE_GREEN'];

/** 카나리·블루그린에 필요한 최소 레플리카 수. 이보다 적으면 서버가 저장을 거절하고, 배포는 롤링으로 대체한다. */
export const MIN_REPLICAS_FOR_PROGRESSIVE = 2;

const LABEL: Record<DeploymentStrategy, MessageKey> = {
  ROLLING: 'svcSettings.strategy.rolling',
  CANARY: 'svcSettings.strategy.canary',
  BLUE_GREEN: 'svcSettings.strategy.blueGreen',
};
const DESC: Record<DeploymentStrategy, MessageKey> = {
  ROLLING: 'svcSettings.strategy.rollingDesc',
  CANARY: 'svcSettings.strategy.canaryDesc',
  BLUE_GREEN: 'svcSettings.strategy.blueGreenDesc',
};

/** 화면에 보여줄 방식 이름. 서버가 모르는 값을 보내면 값을 그대로 보여준다. */
export function strategyLabel(t: (key: MessageKey) => string, strategy: DeploymentStrategy): string {
  const key: MessageKey | undefined = LABEL[strategy];
  return key ? t(key) : strategy;
}
export const strategyDescKey = (strategy: DeploymentStrategy): MessageKey => DESC[strategy];

/** 서비스에 저장된 방식. 배포 방식을 모르는 서버(구버전)는 값을 보내지 않으니 롤링으로 본다. */
export const strategyOf = (service: { deploymentStrategy?: DeploymentStrategy } | undefined): DeploymentStrategy => service?.deploymentStrategy ?? 'ROLLING';

/** 레플리카가 2개 이상이어야 하는 방식인가. */
export const needsReplicas = (strategy: DeploymentStrategy) => strategy !== 'ROLLING';

/** 이 레플리카 수로 배포하면 저장된 방식 대신 롤링으로 대체되는가. */
export const fallsBackToRolling = (strategy: DeploymentStrategy, replicas: number) => needsReplicas(strategy) && replicas < MIN_REPLICAS_FOR_PROGRESSIVE;

/** 서버가 배포 방식 저장을 거절한 오류인가(레플리카 부족이거나 서버가 아직 기능을 켜지 않았다). */
export const isStrategyRejected = (error: unknown) =>
  error instanceof ApiError && error.code === 'INVALID_INPUT' && error.details.some((d) => d.field === 'deploymentStrategy' || d.field.endsWith('.deploymentStrategy'));

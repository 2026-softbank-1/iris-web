import type { Service } from '../data/mock';

type Tone = 'active' | 'deploying' | 'failed' | 'removed';

/** 서비스 상태. 이름은 영어로 둔다(I18N.md). 색은 배포 목록의 status-pill 과 같다. */
export function serviceStatus(service: Service): { label: string; tone: Tone } {
  // 서비스를 내리는 중이면 offlineLabel 이 Removing 이다.
  if (service.deploying) return { label: service.offlineLabel ?? 'Deploying', tone: 'deploying' };
  if (service.state === 'crashed') return { label: 'Failed', tone: 'failed' };
  if (service.state === 'online') return { label: 'Online', tone: 'active' };
  return { label: service.removed ? 'Removed' : 'Offline', tone: 'removed' };
}

export function ServiceStatusPill({ service }: { service: Service }) {
  const { label, tone } = serviceStatus(service);
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

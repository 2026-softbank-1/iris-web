import { SERVER_STATUS_LABEL } from '../data/targetModel';
import { useI18n } from '../i18n';
import type { OnpremServerStatus } from '../lib/endpoints';

// 배포 상태 배지(status-pill)의 색을 그대로 쓴다: 기다림은 앰버, 연결은 초록, 실패는 빨강.
const PILL: Record<OnpremServerStatus, string> = { PENDING: 'queued', REGISTERING: 'deploying', CONNECTED: 'active', FAILED: 'failed' };

export function ServerStatusBadge({ status }: { status: OnpremServerStatus }) {
  const { t } = useI18n();
  return <span className={`status-pill server-pill ${PILL[status]}`}>{t(SERVER_STATUS_LABEL[status])}</span>;
}

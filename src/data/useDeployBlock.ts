import { useI18n } from '../i18n';
import { isTargetDeployable } from '../lib/endpoints';
import { useProjects } from './ProjectsContext';
import { SERVER_STATUS_LABEL, targetLabel } from './targetModel';

/**
 * 서비스의 배포·재배포·수정 후 재배포를 막아야 하는지. 서비스가 쓰는 타깃 중 연결되지 않은 내 서버가 있으면 막고, 그 이유를 돌려준다.
 * 서비스나 타깃을 아직 모르면 막지 않는다(서버가 409 TARGET_NOT_CONNECTED 로 다시 막는다).
 */
export function useDeployBlock(serviceId?: string): { blocked: boolean; reason?: string } {
  const { t } = useI18n();
  const { projects, targets, servers } = useProjects();
  const service = serviceId ? projects.flatMap((p) => p.services).find((s) => s.id === serviceId) : undefined;
  const target = service?.remote?.targetIds.map((id) => targets.find((tg) => tg.id === id)).find((tg) => tg && !isTargetDeployable(tg));
  if (!target?.connectionStatus) return { blocked: false };
  return {
    blocked: true,
    reason: t('servers.deployBlocked', { name: targetLabel(target, servers), status: t(SERVER_STATUS_LABEL[target.connectionStatus]) }),
  };
}

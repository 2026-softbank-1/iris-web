import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOG_LIMIT, deployLogLines, describeLogsError, logsText } from '../../data/deploymentLogModel';
import { fmtKst, type Deployment, type Service } from '../../data/mock';
import { MAX_BUILD_LINES, useBuildLogs, useDeployLogs, useNetworkLogs } from '../../data/useDeploymentLogs';
import { useI18n } from '../../i18n';
import { downloadText } from '../../lib/download';
import type { DeploymentDetailDto, DeploymentTargetDto, StatusClass } from '../../lib/endpoints';
import { LogNotice, LogTable } from './LogTable';
import { NetworkLogTable } from './NetworkLogTable';

type Common = { service: Service; deployment: Deployment };
type WithDetail = Common & { detail: DeploymentDetailDto | null; detailError: unknown };

/**
 * 로그를 볼 타깃. 배포가 반영한 타깃(상세 응답의 configuration.deploy.targets)이 하나면 그것을, 여럿이면 고르게 한다.
 * 상세 응답을 받기 전에는 정해지지 않아서 로그도 기다린다(상세 조회가 실패하면 그 오류를 보여 준다).
 */
function useLogTarget(detail: DeploymentDetailDto | null) {
  const targets = detail?.configuration.deploy.targets ?? [];
  const [picked, setPicked] = useState<number>();
  const targetId = targets.some((x) => x.id === picked) ? picked : targets[0]?.id;
  return { targets, targetId, setPicked, ready: !!detail };
}

function TargetSwitch({ targets, targetId, onPick }: { targets: DeploymentTargetDto[]; targetId?: number; onPick: (id: number) => void }) {
  const { t } = useI18n();
  if (targets.length < 2) return null;
  return (
    <div className="logs-notice">
      <div role="tablist" aria-label={t('service.dp.targets')} className="seg logs-targets">
        {targets.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={targetId === x.id} data-state={targetId === x.id ? 'active' : 'inactive'} onClick={() => onPick(x.id)}>
            <p>{x.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 서비스 이름과 배포 id 가 들어간 로그 파일 이름. 이름에 쓸 수 없는 문자는 `-` 로 바꾼다. */
const logFileName = (service: Service, deployment: Deployment) => `build-logs-${service.name.replace(/[^\w.-]+/g, '-')}-${deployment.id}.txt`;

/** serviceBase 는 서비스 패널 주소(`/project/{id}/service/{id}`)다. 원본 배포의 빌드 로그로 가는 링크에 쓴다. */
export function BuildLogsTab({ service, deployment, serviceBase }: Common & { serviceBase: string }) {
  const { t } = useI18n();
  const build = useBuildLogs(service.id, deployment.id, !!deployment.isActive);
  const sourceId = build.loggedDeploymentId !== undefined && String(build.loggedDeploymentId) !== deployment.id ? build.loggedDeploymentId : undefined;

  return (
    <LogTable
      kind="build"
      lines={build.lines}
      emptyLabel={t('service.dp.noLogs')}
      loading={build.loading}
      error={build.error ? describeLogsError(build.error, t) : null}
      onRetry={build.retry}
      onDownload={() => downloadText(logFileName(service, deployment), logsText(build.lines))}
      header={
        (sourceId !== undefined || build.isPartial || build.capped) && (
          <>
            {sourceId !== undefined && (
              <LogNotice>
                {t('service.dp.build.reused')}{' '}
                <Link to={`${serviceBase}/deployment/${sourceId}/build`} className="logs-notice-link">
                  {t('service.dp.build.openSource', { id: sourceId })}
                </Link>
              </LogNotice>
            )}
            {build.isPartial && <LogNotice>{t('service.dp.build.partial')}</LogNotice>}
            {build.capped && <LogNotice>{t('service.dp.build.capped', { n: MAX_BUILD_LINES.toLocaleString() })}</LogNotice>}
          </>
        )
      }
      footer={build.following && <div className="logs-empty logs-live">{t('service.dp.logs.live')}</div>}
    />
  );
}

export function DeployLogsTab({ service, deployment, detail, detailError }: WithDetail) {
  const { t } = useI18n();
  const { targets, targetId, setPicked, ready } = useLogTarget(detail);
  const logs = useDeployLogs(service.id, deployment.id, targetId, { enabled: ready, active: !!deployment.isActive });
  const lines = useMemo(() => deployLogLines(logs.data?.entries ?? []), [logs.data]);
  const failure = detailError && !detail ? detailError : logs.error;
  const truncated = !!logs.data?.isTruncated;
  const range = logs.data?.start && logs.data.end && !truncated ? { start: fmtKst(logs.data.start), end: fmtKst(logs.data.end) } : undefined;

  return (
    <LogTable
      kind="deploy"
      lines={lines}
      range={range}
      emptyLabel={t('service.dp.noLogs')}
      loading={!detailError && (!ready || logs.loading)}
      error={failure ? describeLogsError(failure, t) : null}
      onRetry={detailError && !detail ? undefined : logs.reload}
      onRefresh={logs.reload}
      header={
        <>
          <TargetSwitch targets={targets} targetId={targetId} onPick={setPicked} />
          {truncated && <LogNotice>{t('service.dp.logs.truncated', { n: LOG_LIMIT.toLocaleString() })}</LogNotice>}
        </>
      }
    />
  );
}

export function NetworkLogsTab({ service, deployment, detail, detailError }: WithDetail) {
  const { t } = useI18n();
  const { targets, targetId, setPicked, ready } = useLogTarget(detail);
  const [statusClass, setStatusClass] = useState<StatusClass>();
  const logs = useNetworkLogs(service.id, deployment.id, targetId, statusClass, { enabled: ready });
  const failure = detailError && !detail ? detailError : logs.error;

  return (
    <NetworkLogTable
      entries={logs.data?.entries ?? []}
      statusClass={statusClass}
      onStatusClass={setStatusClass}
      emptyLabel={t('service.dp.net.empty')}
      loading={!detailError && (!ready || logs.loading)}
      error={failure ? describeLogsError(failure, t) : null}
      onRetry={detailError && !detail ? undefined : logs.reload}
      onRefresh={logs.reload}
      header={
        <>
          <TargetSwitch targets={targets} targetId={targetId} onPick={setPicked} />
          {logs.data?.isTruncated && <LogNotice>{t('service.dp.net.truncated', { n: LOG_LIMIT.toLocaleString() })}</LogNotice>}
        </>
      }
    />
  );
}

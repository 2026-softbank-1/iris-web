import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Server, Trash2 } from 'lucide-react';
import { OnpremServerDialog } from '../components/OnpremServerDialog';
import { ServerStatusBadge } from '../components/ServerStatusBadge';
import { ConfirmDialog, useUI } from '../components/ui';
import { useProjects } from '../data/ProjectsContext';
import { fmtKst } from '../data/mock';
import { serverErrorMessage } from '../data/targetModel';
import { formatAgo, useI18n } from '../i18n';
import { describeError } from '../lib/api';
import * as api from '../lib/endpoints';

/** 사이드바의 "내 서버" 화면. */
export function OnpremServersPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="page-inner">
        <div className="pg-head">
          <p className="page-title">{t('nav.servers')}</p>
        </div>
        <div className="server-page">
          <OnpremServers />
        </div>
      </div>
    </div>
  );
}

/** 내 서버 목록. 목록은 ProjectsContext 가 쥐고, 연결을 기다리는 서버가 있으면 그쪽에서 다시 받는다. */
export function OnpremServers() {
  const { t, lang } = useI18n();
  const { toast } = useUI();
  const { servers, reloadTargets } = useProjects();
  const [load, setLoad] = useState<{ status: 'loading' | 'ready' | 'error'; error?: string }>({ status: 'loading' });
  const [adding, setAdding] = useState(false);
  const [reissued, setReissued] = useState<api.OnpremServerRegistrationDto>();
  const [deleting, setDeleting] = useState<api.OnpremServerDto | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = () => {
    setLoad((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    reloadTargets().then(
      () => setLoad({ status: 'ready' }),
      (e) => setLoad({ status: 'error', error: describeError(e) }),
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, []);

  const reissue = async (server: api.OnpremServerDto) => {
    setBusyId(server.id);
    try {
      setReissued(await api.reissueRegistrationToken(server.id));
      void reloadTargets().catch(() => undefined);
    } catch (e) {
      const key = serverErrorMessage(e);
      toast(key ? t(key) : describeError(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (server: api.OnpremServerDto) => {
    setDeleting(null);
    setBusyId(server.id);
    try {
      await api.deleteOnpremServer(server.id);
      toast(t('servers.deleted'));
      await reloadTargets().catch(() => undefined);
    } catch (e) {
      const key = serverErrorMessage(e);
      toast(key ? t(key) : describeError(e));
    } finally {
      setBusyId(null);
    }
  };

  const isExpired = (server: api.OnpremServerDto) => !!server.registrationExpiresAt && Date.parse(server.registrationExpiresAt) <= Date.now();

  return (
    <div className="server-list-card">
      <div className="server-list-head">
        <p className="set-muted">{t('servers.subtitle')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> {t('servers.add')}
        </button>
      </div>

      {load.status === 'loading' && servers.length === 0 ? (
        <p className="set-muted" role="status">{t('servers.loading')}</p>
      ) : load.status === 'error' && servers.length === 0 ? (
        <div className="server-empty" role="alert">
          <p className="tpl-empty-title">{t('servers.loadError')}</p>
          <p className="tpl-empty-sub">{load.error}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh}>{t('servers.retry')}</button>
        </div>
      ) : servers.length === 0 ? (
        <div className="server-empty">
          <Server size={20} />
          <p className="tpl-empty-title">{t('servers.emptyTitle')}</p>
          <p className="tpl-empty-sub">{t('servers.emptyBody')}</p>
        </div>
      ) : (
        <ul className="server-list" aria-label={t('servers.title')}>
          {servers.map((server) => {
            // 연결 확인 중(REGISTERING)에도 명령을 다시 받아 처음부터 다시 실행할 수 있다(상태는 PENDING 으로 돌아간다).
            const canReissue = server.status !== 'CONNECTED';
            return (
              <li key={server.id} className="server-row">
                <div className="server-row-main">
                  <div className="server-row-title">
                    <b>{server.name}</b>
                    <span className="mono server-key">{server.serverKey}</span>
                    <ServerStatusBadge status={server.status} />
                  </div>
                  <p className="server-row-meta">
                    {server.connectedAt ? t('servers.connectedAgo', { ago: formatAgo(server.connectedAt, lang) }) : t('servers.addedAgo', { ago: formatAgo(server.createdAt, lang) })}
                    {server.tailnetFqdn && <> · <span className="mono">{server.tailnetFqdn}</span></>}
                    {server.status === 'PENDING' && server.registrationExpiresAt && (
                      <> · {isExpired(server) ? t('servers.tokenExpired') : t('servers.tokenExpires', { time: fmtKst(server.registrationExpiresAt, false) })}</>
                    )}
                  </p>
                  {server.status === 'FAILED' && (
                    <p className="server-row-error">{t(server.failureCode === 'GITOPS_COMMIT_FAILED' ? 'servers.failure.GITOPS_COMMIT_FAILED' : 'servers.failure.CONNECT_TIMED_OUT')}</p>
                  )}
                </div>
                <div className="server-row-actions" aria-label={t('servers.actions')}>
                  {canReissue && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busyId === server.id} onClick={() => void reissue(server)}>
                      <RotateCcw size={14} /> {t('servers.reissue')}
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" disabled={busyId === server.id} onClick={() => setDeleting(server)}>
                    <Trash2 size={14} /> {t('servers.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <OnpremServerDialog open={adding} onClose={() => setAdding(false)} />
      <OnpremServerDialog open={!!reissued} registration={reissued} onClose={() => setReissued(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
        title={t('servers.deleteTitle')}
        confirmLabel={t('servers.deleteConfirm')}
        cancelLabel={t('servers.cancel')}
      >
        {deleting && t('servers.deleteBody', { name: deleting.name })}
      </ConfirmDialog>
    </div>
  );
}

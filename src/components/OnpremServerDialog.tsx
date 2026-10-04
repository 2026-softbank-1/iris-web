import { useEffect, useRef, useState } from 'react';
import { CircleCheckBig, Clock, Copy, Server, TriangleAlert, X } from 'lucide-react';
import { useProjects } from '../data/ProjectsContext';
import { fmtKst } from '../data/mock';
import { SERVER_NAME_ISSUE_MESSAGE, serverNameErrorMessage, validateServerName } from '../data/serverNameModel';
import { isRegistrationExpired, isServerConnecting, serverErrorMessage, shouldPollServer } from '../data/targetModel';
import { useI18n, type MessageKey } from '../i18n';
import { describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { Dialog, useUI } from './ui';
import { ServerStatusBadge } from './ServerStatusBadge';

const POLL_MS = 3000;

/**
 * 서버 추가(이름 → 설치 명령)와 설치 명령 다시 받기를 한 창에서 한다. 명령을 보여 준 뒤에는 3초마다 서버 상태를 받아
 * CONNECTED·FAILED 가 될 때까지 기다린다. 등록 토큰은 이 창에서만 보이고 닫으면 다시 볼 수 없다.
 */
export function OnpremServerDialog({
  open,
  onClose,
  registration: initial,
  onCreated,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** 이미 받은 설치 명령(토큰 재발급 결과). 없으면 이름부터 받는다. */
  registration?: api.OnpremServerRegistrationDto;
  /** 서버(와 그 타깃)를 만든 직후 한 번 부른다. */
  onCreated?: (server: api.OnpremServerDto) => void;
  /** 닫기 버튼 문구. 서비스 만들기에서 열었으면 그 화면으로 돌아간다는 문구를 준다. */
  closeLabel?: MessageKey;
}) {
  const { t } = useI18n();
  const { toast } = useUI();
  const { reloadTargets } = useProjects();
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState<api.OnpremServerRegistrationDto | null>(null);
  const [server, setServer] = useState<api.OnpremServerDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 서버가 이름 때문에 거절한 사유(규칙 위반·중복). 이름을 고치면 사라진다.
  const [nameRejection, setNameRejection] = useState<MessageKey | null>(null);
  // 기다림을 멈춘 이유. expired 는 토큰이 만료돼 명령을 다시 받아야 하고, stalled 는 20분이 지나 다시 확인을 눌러야 한다.
  const [stopped, setStopped] = useState<'expired' | 'stalled' | null>(null);
  const [resumedAt, setResumedAt] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName('');
    setRegistration(initial ?? null);
    setServer(initial?.server ?? null);
    setBusy(false);
    setError('');
    setNameRejection(null);
    setStopped(null);
    setResumedAt(0);
  }, [open, initial]);

  const serverRef = useRef(server);
  serverRef.current = server;
  // 지금 상태를 처음 본 시각. REGISTERING 은 응답에 상태가 바뀐 시각이 없어서 이것으로 20분을 센다.
  const observed = useRef<{ status?: api.OnpremServerStatus; at: number }>({ at: 0 });
  if (observed.current.status !== server?.status) observed.current = { status: server?.status, at: Date.now() };

  const serverId = server?.id;
  const waiting = !!server && isServerConnecting(server.status) && !stopped;
  useEffect(() => {
    if (!open || serverId === undefined || !waiting) return;
    const ctrl = new AbortController();
    const timer = window.setInterval(() => {
      const current = serverRef.current;
      if (!current) return;
      const now = Date.now();
      if (isRegistrationExpired(current, now)) { setStopped('expired'); return; }
      if (!shouldPollServer(current, observed.current.at, now, resumedAt)) { setStopped('stalled'); return; }
      api.getOnpremServer(serverId, ctrl.signal).then(
        (next) => {
          // 상태가 바뀌면 배포 대상 목록의 상태 배지·배포 버튼도 같이 바뀌게 한다.
          if (serverRef.current?.status !== next.status) void reloadTargets().catch(() => undefined);
          setServer(next);
        },
        () => undefined, // 잠깐 못 받아도 다음 주기에 다시 받는다.
      );
    }, POLL_MS);
    return () => { ctrl.abort(); window.clearInterval(timer); };
  }, [open, serverId, waiting, resumedAt, reloadTargets]);

  // 서버와 같은 규칙으로 입력 중에 검사한다. 비어 있는 입력은 아직 에러로 칠하지 않지만 등록은 막는다.
  const nameIssue = validateServerName(name);
  const nameMessage = name !== '' && nameIssue ? SERVER_NAME_ISSUE_MESSAGE[nameIssue] : nameRejection;

  const create = async () => {
    if (busy || validateServerName(name)) return;
    setBusy(true);
    setError('');
    setNameRejection(null);
    try {
      const created = await api.createOnpremServer(name.trim());
      setRegistration(created);
      setServer(created.server);
      await reloadTargets().catch(() => undefined);
      onCreated?.(created.server);
    } catch (e) {
      // 이름 때문에 거절됐으면 입력란 아래에, 아니면 창 아래 알림에 보인다. 서버가 항상 최종 판정이다.
      const nameKey = serverNameErrorMessage(e);
      if (nameKey) {
        setNameRejection(nameKey);
      } else {
        const key = serverErrorMessage(e);
        setError(key ? t(key) : describeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const reissue = async () => {
    if (busy || !server) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.reissueRegistrationToken(server.id);
      setRegistration(next);
      setServer(next.server);
      setStopped(null);
      setResumedAt(0);
      void reloadTargets().catch(() => undefined);
    } catch (e) {
      const key = serverErrorMessage(e);
      setError(key ? t(key) : describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (command: string) => {
    void navigator.clipboard?.writeText(command).then(() => toast(t('servers.dialog.copied')), () => undefined);
  };

  const title = t(initial ? 'servers.dialog.reissueTitle' : 'servers.dialog.title');
  return (
    <Dialog open={open} onClose={onClose} className="create-dialog server-dialog" label={title}>
      <header>
        <h2>{title}</h2>
        <button type="button" className="create-icon" aria-label={t('servers.dialog.close')} onClick={onClose}><X size={18} /></button>
      </header>
      {!registration ? (
        <form className="create-review" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <label>
            {t('servers.dialog.nameLabel')}
            <input
              autoFocus
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="home-lab"
              value={name}
              aria-invalid={!!nameMessage}
              onChange={(e) => { setName(e.target.value); setNameRejection(null); }}
            />
            {nameMessage && <span className="server-hint error" role={nameMessage === nameRejection ? 'alert' : undefined}>{t(nameMessage)}</span>}
            <span className="server-hint">{t('servers.dialog.nameHint')}</span>
          </label>
          <Requirements />
          <button type="submit" className="btn btn-primary" disabled={busy || nameIssue !== null}>{t(busy ? 'servers.dialog.creating' : 'servers.dialog.create')}</button>
        </form>
      ) : (
        <div className="server-install">
          {server && (
            <div className="server-install-head">
              <Server size={16} />
              <b>{server.name}</b>
              <span className="mono server-key">{server.serverKey}</span>
              <ServerStatusBadge status={server.status} />
            </div>
          )}
          {server?.status !== 'CONNECTED' && stopped !== 'expired' && (
            <>
              <Requirements />
              <p>{t('servers.dialog.runCommand')}</p>
              <div className="server-command">
                <pre className="mono">{registration.installCommand}</pre>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(registration.installCommand)}><Copy size={14} />{t('servers.dialog.copy')}</button>
              </div>
              <p className="server-hint">
                {t('servers.dialog.tokenOnce')}
                {registration.server.registrationExpiresAt && <> {t('servers.dialog.expires', { time: fmtKst(registration.server.registrationExpiresAt, false) })}</>}
              </p>
            </>
          )}
          {waiting && (
            <div className="server-wait" role="status">
              <span className="server-spinner" aria-hidden />
              <p>{t(server?.status === 'REGISTERING' ? 'servers.dialog.waitingRegistering' : 'servers.dialog.waitingPending')}</p>
            </div>
          )}
          {stopped === 'expired' && server?.status === 'PENDING' && (
            <div className="server-result failed" role="alert">
              <Clock size={18} />
              <p>{t('servers.dialog.expired')}</p>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void reissue()}>{t('servers.reissue')}</button>
            </div>
          )}
          {stopped === 'stalled' && server && isServerConnecting(server.status) && (
            <div className="server-result stalled" role="status">
              <Clock size={18} />
              <p>{t('servers.dialog.stalled')}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setResumedAt(Date.now()); setStopped(null); }}>{t('servers.dialog.checkAgain')}</button>
            </div>
          )}
          {server?.status === 'CONNECTED' && (
            <div className="server-result ok" role="status"><CircleCheckBig size={18} /><p>{t('servers.dialog.connected')}</p></div>
          )}
          {server?.status === 'FAILED' && (
            <div className="server-result failed" role="alert">
              <TriangleAlert size={18} />
              <p>{t(server.failureCode === 'GITOPS_COMMIT_FAILED' ? 'servers.failure.GITOPS_COMMIT_FAILED' : 'servers.failure.CONNECT_TIMED_OUT')}</p>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void reissue()}>{t('servers.reissue')}</button>
            </div>
          )}
          <div className="server-actions">
            <button type="button" className={`btn ${server?.status === 'CONNECTED' ? 'btn-primary' : 'btn-outline'}`} onClick={onClose}>
              {t(closeLabel ?? (server?.status === 'CONNECTED' ? 'servers.dialog.done' : 'servers.dialog.close'))}
            </button>
          </div>
        </div>
      )}
      {error && <p className="create-notice" role="alert">{error}</p>}
    </Dialog>
  );
}

function Requirements() {
  const { t } = useI18n();
  return (
    <div className="server-reqs">
      <b>{t('servers.dialog.requirementsTitle')}</b>
      <ul>
        <li>{t('servers.dialog.requirementOs')}</li>
        <li>{t('servers.dialog.requirementSudo')}</li>
      </ul>
      <p>{t('servers.dialog.requirementInstall')}</p>
    </div>
  );
}

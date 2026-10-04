import { Copy, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ServiceStatusPill } from '../../components/ServiceStatusPill';
import { useUI } from '../../components/ui';
import type { Project, Service } from '../../data/mock';
import { useI18n, type MessageKey } from '../../i18n';
import type { ReferenceProperty } from '../../lib/endpoints';
import { DataLossNotice, ENGINE_LABEL } from '../../components/DatabaseBits';

const PROPERTY_KEYS: Record<ReferenceProperty, MessageKey> = {
  url: 'stack.prop.url',
  host: 'stack.prop.host',
  port: 'stack.prop.port',
  user: 'stack.prop.user',
  password: 'stack.prop.password',
  database: 'stack.prop.database',
};

/** 관리형 DB 서비스의 첫 탭: 엔진, 클러스터 내부 주소, 마스킹된 연결 문자열, 변수로 연결하는 방법, 데이터 경고. */
export function DatabaseTab({ project, service }: { project: Project; service: Service }) {
  const { t } = useI18n();
  const { toast } = useUI();
  const remote = service.remote;
  const engine = remote?.databaseEngine;
  const host = remote?.internalHost;
  const port = remote?.internalPort;
  const connection = remote?.connection;
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast(t('stack.db.copied'));
  };
  const base = `/project/${project.id}/service/${service.id}`;
  return (
    <div className="db-tab">
      <div className="db-head">
        <div className="db-head-icon"><Database size={22} aria-hidden /></div>
        <div>
          <h2>{engine ? ENGINE_LABEL[engine] : t('stack.db.managed')}</h2>
          <p className="st-muted">{t('stack.db.managedDesc')}</p>
        </div>
        <ServiceStatusPill service={service} />
      </div>

      <dl className="db-facts">
        <div>
          <dt>{t('stack.db.internalHost')}</dt>
          <dd className="mono db-copy">
            <span>{host ?? '—'}</span>
            {host && <button type="button" className="icon-btn" aria-label={t('stack.db.copy')} onClick={() => copy(host)}><Copy size={14} /></button>}
          </dd>
        </div>
        <div>
          <dt>{t('stack.prop.port')}</dt>
          <dd className="mono">{port ?? '—'}</dd>
        </div>
        {remote?.database?.image && (
          <div>
            <dt>{t('stack.db.image')}</dt>
            <dd className="mono">{remote.database.image}</dd>
          </div>
        )}
        {remote?.database?.storageGi && (
          <div>
            <dt>{t('stack.db.storage')}</dt>
            <dd>{remote.database.storageGi} GiB <span className="st-muted">· {t('stack.db.sizeFixed')}</span></dd>
          </div>
        )}
        <div>
          <dt>{t('stack.db.connection')}</dt>
          <dd className="mono db-copy">
            <span>{connection?.urlTemplate ?? '—'}</span>
            {connection && <button type="button" className="icon-btn" aria-label={t('stack.db.copy')} onClick={() => copy(connection.urlTemplate)}><Copy size={14} /></button>}
          </dd>
          <dd className="st-muted db-note">{t('stack.db.masked')}</dd>
        </div>
      </dl>

      {remote?.database?.initScripts && remote.database.initScripts.length > 0 && (
        <section className="db-init">
          <h3>{t('stack.init.title')}</h3>
          <p className="st-muted">{t('stack.init.once')}</p>
          <ul>
            {remote.database.initScripts.map((sc) => (
              <li key={sc.name}>
                <span className="mono">{sc.path ?? sc.name}</span>
                <span className="st-muted mono">{sc.name} · {(sc.size / 1024).toFixed(1)} KiB · {sc.sha256.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="db-connect">
        <h3>{t('stack.db.connectTitle')}</h3>
        <p className="st-muted">{t('stack.db.connectDesc')}</p>
        {connection && connection.properties.length > 0 && (
          <ul className="db-props">
            {connection.properties.map((p) => (
              <li key={p}><span className="gate-code">{p}</span><span>{t(PROPERTY_KEYS[p] ?? 'stack.prop.url')}</span></li>
            ))}
          </ul>
        )}
        <p className="st-muted">
          {t('stack.db.connectHow')} <Link to={`${base}/variables`}>{t('stack.db.variablesLink')}</Link>
        </p>
      </section>

      <DataLossNotice />
    </div>
  );
}

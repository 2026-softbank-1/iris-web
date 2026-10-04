import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Project, Service } from '../../data/mock';
import { useI18n } from '../../i18n';
import { REFERENCE_PROPERTIES, type ReferenceProperty, type VariableDto, type VariableReferenceDto } from '../../lib/endpoints';
import { ENGINE_LABEL } from '../../components/DatabaseBits';

const APP_PROPERTIES: ReferenceProperty[] = ['url', 'host', 'port'];

/** 속성 목록: DB 는 서버가 알려 준 connection.properties, 앱은 url·host·port. */
const propertiesOf = (service: Service): ReferenceProperty[] =>
  service.remote?.referenceProperties?.length ? service.remote.referenceProperties : service.remote?.kind === 'DATABASE' ? (service.remote.connection?.properties ?? REFERENCE_PROPERTIES) : APP_PROPERTIES;

/** 이 서비스의 변수 값을 같은 프로젝트의 다른 서비스 연결 정보(`postgres.url` 등)에 연결한다. 배포할 때 실제 값으로 풀린다. */
export function ReferenceVariableForm({ project, service, existing, initialKey, busy, onCancel, onSave }: {
  project: Project;
  service: Service;
  existing: VariableDto[];
  /** 빈 문자열이면 새 변수, 이미 있는 참조 변수의 키면 그 참조를 바꾼다. */
  initialKey: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (key: string, reference: VariableReferenceDto) => void | Promise<void>;
}) {
  const { t } = useI18n();
  // DB 를 먼저 보여 준다. 자기 자신은 가리킬 수 없다.
  const targets = useMemo(
    () => project.services.filter((s) => s.id !== service.id).sort((a, b) => Number(b.remote?.kind === 'DATABASE') - Number(a.remote?.kind === 'DATABASE')),
    [project.services, service.id],
  );
  const current = existing.find((v) => v.key === initialKey)?.reference;
  const [key, setKey] = useState(initialKey);
  const [serviceId, setServiceId] = useState(current ? String(current.serviceId) : (targets[0]?.id ?? ''));
  const target = targets.find((s) => s.id === serviceId);
  const props = target ? propertiesOf(target) : [];
  const [property, setProperty] = useState<ReferenceProperty>(current?.property ?? 'url');
  const effective = props.includes(property) ? property : (props[0] ?? 'url');
  const keyOk = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key);
  const literalClash = existing.some((v) => v.key === key && !v.reference);

  return (
    <form
      className="vars-new vars-ref-form"
      aria-label={t('stack.vars.addReference')}
      onSubmit={(e) => {
        e.preventDefault();
        if (keyOk && target) void onSave(key, { serviceId: Number(target.id), property: effective });
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
    >
      <input
        className="input mono"
        autoFocus={!initialKey}
        readOnly={!!initialKey}
        placeholder="DATABASE_URL"
        aria-label={t('stack.vars.refKey')}
        value={key}
        onChange={(e) => setKey(e.target.value.replace(/[^A-Za-z0-9_]/g, '_'))}
      />
      <select className="input" aria-label={t('stack.vars.refService')} value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={targets.length === 0}>
        {targets.length === 0 && <option value="">{t('stack.vars.noTargets')}</option>}
        {targets.map((s) => (
          <option key={s.id} value={s.id}>{s.name}{s.remote?.databaseEngine ? ` · ${ENGINE_LABEL[s.remote.databaseEngine]}` : ''}</option>
        ))}
      </select>
      <select className="input mono" aria-label={t('stack.vars.refProperty')} value={effective} onChange={(e) => setProperty(e.target.value as ReferenceProperty)}>
        {props.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" className="btn btn-primary" disabled={!keyOk || !target || busy}>{t('stack.vars.link')}</button>
      <button type="button" className="btn btn-outline btn-icon-only" aria-label={t('service.vars.cancel')} onClick={onCancel}><X size={16} /></button>
      {literalClash && <p className="vars-note warn ref-form-note">{t('stack.vars.refReplaces')}</p>}
    </form>
  );
}

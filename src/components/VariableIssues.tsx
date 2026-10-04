import { CircleAlert, Lightbulb, TriangleAlert } from 'lucide-react';
import type { Service } from '../data/mock';
import type { VariableIssueDto } from '../lib/endpoints';
import { useI18n, type MessageKey } from '../i18n';

const CODE_KEYS: Record<string, MessageKey> = {
  REQUIRED_MISSING: 'stack.issue.REQUIRED_MISSING',
  LOCALHOST_ADDRESS: 'stack.issue.LOCALHOST_ADDRESS',
  UNRESOLVABLE_HOST: 'stack.issue.UNRESOLVABLE_HOST',
  SCHEME_MISMATCH: 'stack.issue.SCHEME_MISMATCH',
  REFERENCE_BROKEN: 'stack.issue.REFERENCE_BROKEN',
};

/** 검증 이슈 목록. suggestion 이 있으면 원클릭 적용 버튼을 준다(onApply 가 있을 때). 서버가 준 영문 message 는 그대로 보조 설명으로 둔다. */
export function VariableIssueList({
  issues,
  services,
  onApply,
  applying,
  serviceName,
}: {
  issues: VariableIssueDto[];
  services: Service[];
  onApply?: (issue: VariableIssueDto) => void;
  applying?: string | null;
  /** 이슈에 serviceId 가 있을 때 앞에 붙일 서비스 이름(스택 배포 거절처럼 여러 서비스가 섞일 때). */
  serviceName?: (issue: VariableIssueDto) => string | undefined;
}) {
  const { t } = useI18n();
  const nameOf = (id: number) => services.find((s) => s.id === String(id))?.name ?? `#${id}`;
  return (
    <ul className="var-issues">
      {issues.map((issue, i) => {
        const codeKey = CODE_KEYS[issue.code];
        const suggestion = issue.suggestion?.reference;
        const id = `${issue.key}:${issue.code}`;
        const svc = serviceName?.(issue);
        return (
          <li key={`${id}-${i}`} className={`var-issue ${issue.severity}`}>
            <span className="var-issue-icon" aria-hidden>{issue.severity === 'error' ? <CircleAlert size={16} /> : <TriangleAlert size={16} />}</span>
            <div className="var-issue-body">
              <p className="var-issue-title">
                {svc && <span className="gate-code">{svc}</span>}
                <span className="mono var-issue-key">{issue.key}</span>
                <span>{codeKey ? t(codeKey) : issue.code}</span>
                <span className="sr-only">{t(issue.severity === 'error' ? 'stack.issue.error' : 'stack.issue.warning')}</span>
              </p>
              {issue.message && <p className="var-issue-msg">{issue.message}</p>}
              {suggestion && (
                <div className="var-issue-suggest">
                  <Lightbulb size={14} aria-hidden />
                  <span>{t('stack.issue.suggest', { target: `${nameOf(suggestion.serviceId)}.${suggestion.property}` })}</span>
                  {onApply && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={applying === id} onClick={() => onApply(issue)}>
                      {t(applying === id ? 'stack.issue.applying' : 'stack.issue.apply')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const issueId = (issue: VariableIssueDto) => `${issue.key}:${issue.code}`;

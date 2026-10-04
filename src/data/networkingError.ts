import type { MessageKey } from '../i18n';
import { ApiError } from '../lib/api';

/**
 * DB·호스트 별칭·참조 변수를 쓸 수 없는 타깃/프로젝트면 서버가 422 INVALID_INPUT 의 details[].reason 으로 알린다.
 * 알려진 사유면 번역 키를, 아니면 null 을 돌려준다.
 */
export function networkingErrorKey(error: unknown): MessageKey | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  for (const d of error.details) {
    if (d.reason === 'networking_unsupported_target') return 'stack.err.networkingUnsupportedTarget';
    if (d.reason === 'project_networking_disabled') return 'stack.err.networkingDisabled';
  }
  return null;
}

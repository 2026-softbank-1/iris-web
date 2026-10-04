import type { MessageKey } from '../i18n';
import { ApiError } from '../lib/api';
import { serverErrorMessage } from './targetModel';

/**
 * 내 서버 이름 규칙. 판정하는 쪽은 서버(was)이고, 웹은 같은 규칙으로 미리 알려 줄 뿐이다.
 * 앞뒤 공백을 자른 이름이 1~63자이고, 영문 대소문자·숫자·한글 완성형(가-힣)·`.`·`_`·`-` 만 쓰며,
 * 첫 글자는 영문·숫자·한글이어야 하고, 숫자만으로는 안 된다(CLI 의 `<이름|id>` 가 숫자를 id 로 먼저 읽는다).
 * 이미 등록한 이름은 영향받지 않고, 만들 때만 검사한다.
 */
export const SERVER_NAME_RE = /^(?![0-9]+$)[A-Za-z0-9가-힣][A-Za-z0-9가-힣._-]{0,62}$/;
export const SERVER_NAME_MAX_LENGTH = 63;

/** 이름이 규칙을 어긴 이유. 서버가 판정하는 순서(비어 있음 → 너무 김 → 숫자만 → 첫 글자 → 문자)와 같다. */
export type ServerNameIssue = 'blank' | 'tooLong' | 'onlyDigits' | 'badStart' | 'badChar';

const ONLY_DIGITS = /^[0-9]+$/;
const VALID_START = /^[A-Za-z0-9가-힣]/;

/**
 * 이름이 규칙을 지키면 null, 어기면 첫 번째 이유를 돌려준다. 앞뒤 공백은 무시한다(웹은 자른 이름을 보낸다).
 * 통과 여부는 SERVER_NAME_RE 와 항상 같다. 이유만 순서대로 가려낸다.
 */
export function validateServerName(raw: string): ServerNameIssue | null {
  const name = raw.trim();
  if (SERVER_NAME_RE.test(name)) return null;
  if (name === '') return 'blank';
  if (name.length > SERVER_NAME_MAX_LENGTH) return 'tooLong';
  if (ONLY_DIGITS.test(name)) return 'onlyDigits';
  if (!VALID_START.test(name)) return 'badStart';
  return 'badChar';
}

/** 규칙을 어긴 이유 → 화면 문구. */
export const SERVER_NAME_ISSUE_MESSAGE: Record<ServerNameIssue, MessageKey> = {
  blank: 'servers.dialog.nameError.blank',
  tooLong: 'servers.dialog.nameError.tooLong',
  onlyDigits: 'servers.dialog.nameError.onlyDigits',
  badStart: 'servers.dialog.nameError.badStart',
  badChar: 'servers.dialog.nameError.badChar',
};
/** 서버가 이름을 거절하면서 준 이유가 위 이유 중 무엇인지 모를 때 보여 주는 규칙 안내. */
const SERVER_NAME_UNKNOWN_REASON_MESSAGE: MessageKey = 'servers.dialog.nameError.rule';

/** 서버 422 `details[].reason` 의 고정 영어 문구 → 이유. 문구가 바뀌면 여기에 없어 규칙 안내로 넘어간다. */
const SERVER_NAME_REASON = new Map<string, ServerNameIssue>([
  ['must not be blank', 'blank'],
  ['must be at most 63 characters', 'tooLong'],
  ['must not be only digits', 'onlyDigits'],
  ['must start with a letter, digit or Hangul syllable', 'badStart'],
  ["may contain only letters, digits, Hangul syllables, '.', '_' and '-' (no spaces)", 'badChar'],
]);

// describeError 가 details 를 풀어 쓰는 두 코드. 서버는 규칙을 어긴 이름을 422 INVALID_INPUT 으로 거절한다.
const NAME_REJECTION_CODES = new Set(['INVALID_INPUT', 'VALIDATION_ERROR']);

/**
 * 서버가 이름 때문에 거절한 오류의 문구 키(이름 입력란 아래에 보인다). 이름과 상관없는 오류는 null 이라
 * 호출한 쪽이 serverErrorMessage·describeError 로 이어서 처리한다.
 * - 409 ONPREM_SERVER_NAME_CONFLICT: 같은 이름의 서버가 이미 있다.
 * - `details[]` 에 `field: name` 이 있는 입력 오류: 아는 이유면 그 이유의 문구, 모르는 이유면 규칙 전체 안내.
 */
export function serverNameErrorMessage(error: unknown): MessageKey | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'ONPREM_SERVER_NAME_CONFLICT') return serverErrorMessage(error);
  if (!NAME_REJECTION_CODES.has(error.code)) return null;
  const reasons = error.details.filter((d) => d.field === 'name').map((d) => SERVER_NAME_REASON.get(d.reason));
  if (reasons.length === 0) return null;
  const known = reasons.find((issue) => issue !== undefined);
  return known ? SERVER_NAME_ISSUE_MESSAGE[known] : SERVER_NAME_UNKNOWN_REASON_MESSAGE;
}

import type { MessageKey } from '../i18n';
import type { ErrorDetail } from '../lib/api';
import type { VariableDto } from '../lib/endpoints';

const byKey = (a: VariableDto, b: VariableDto) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** 변수 하나를 넣거나(같은 키가 있으면 값을 바꾸고) 서버처럼 키 순으로 둔다. */
export const withVariable = (list: VariableDto[], entry: VariableDto): VariableDto[] =>
  [...list.filter((v) => v.key !== entry.key), entry].sort(byKey);

export const withoutVariable = (list: VariableDto[], key: string): VariableDto[] => list.filter((v) => v.key !== key);

/**
 * Raw Editor 를 채울 텍스트. 값은 JSON 문자열로 쓴다(줄바꿈·따옴표가 있어도 한 줄이 된다).
 * 서버가 큰따옴표 값을 JSON 이스케이프로 읽으니, 그대로 저장하면 같은 값이다.
 */
export const toRaw = (list: VariableDto[]): string => list.map((v) => `${v.key}=${JSON.stringify(v.value)}`).join('\n');

/**
 * 서버가 422 INVALID_INPUT 에 싣는 메시지(영문)와 그에 맞는 문구. 코드가 하나라 메시지로 가른다.
 * 여기 없는 메시지(서버가 늘린 것)는 서버 메시지를 그대로 보여준다.
 */
export const INVALID_INPUT_KEYS: Record<string, MessageKey> = {
  'variable key must be letters, digits and underscores, not starting with a digit': 'service.vars.err.keyFormat',
  'variable key is reserved by the platform': 'service.vars.err.keyReserved',
  'variable value is too long': 'service.vars.err.valueTooLong',
  'too many variables': 'service.vars.err.tooMany',
  'invalid variable line': 'service.vars.err.invalidLine',
};

const TOO_LONG_KEYS: Record<string, MessageKey> = {
  key: 'service.vars.err.keyTooLong',
  value: 'service.vars.err.valueTooLong',
  raw: 'service.vars.err.rawTooLong',
};

/** 서버 스키마 검증(422 VALIDATION_ERROR)이 길이 초과를 알려 주면 그 필드의 문구를 돌려준다. 그 밖의 검증은 null 이다. */
export const validationKey = (details: ErrorDetail[]): MessageKey | null => {
  for (const d of details) {
    const key = TOO_LONG_KEYS[d.field];
    if (key && /at most/i.test(d.reason)) return key;
  }
  return null;
};

export type RawIssue = { line: number; key?: string; unclosedQuote: boolean; keyTooLong: boolean };

/**
 * Raw 저장이 거부될 때 서버가 details 에 싣는 `{field: 'raw', reason: 'line N: ...'}` 를 읽는다. 줄 번호는 1부터이고,
 * 예약어·긴 값처럼 키 이름이 들어오는 사유는 키도 꺼낸다. 값은 서버가 싣지 않는다. 줄 번호가 없는 항목은 건너뛴다.
 */
export const rawIssues = (details: ErrorDetail[]): RawIssue[] =>
  details.flatMap((d) => {
    const m = d.field === 'raw' ? /^line (\d+): (.*)$/.exec(d.reason) : null;
    if (!m) return [];
    const reason = m[2];
    const key = /^reserved key (\S+)$/.exec(reason)?.[1] ?? /^value of (\S+) is longer than /.exec(reason)?.[1];
    return [{ line: Number(m[1]), key, unclosedQuote: reason === 'quoted value is not closed', keyTooLong: /^key .+ is longer than \d+ characters$/.test(reason) }];
  });


/** A suggested first-use value; nothing is persisted until the developer saves. */
export function initialVariableValue(key: string): string {
  if (key !== 'SESSION_SECRET') return '';
  return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Preserve variables not supplied by the uploaded file. Server validates and parses values. */
export function mergeUploadedEnvironment(existing: VariableDto[], file: string): string {
  // The .env parser uses the last value for duplicate keys, including multiline values.
  return [toRaw(existing), file].filter(Boolean).join('\n');
}

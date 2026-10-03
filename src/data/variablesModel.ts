import type { MessageKey } from '../i18n';
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

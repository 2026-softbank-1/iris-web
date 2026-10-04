import { useCallback, useEffect, useState } from 'react';
import type { MessageKey, Vars } from '../i18n';
import { ApiError, describeError } from '../lib/api';
import * as api from '../lib/endpoints';
import { INVALID_INPUT_KEYS, rawIssues, validationKey, withVariable, withoutVariable } from './variablesModel';

type Loaded = { serviceId: string; data?: api.ServiceVariablesDto; failure?: { error: unknown } };

/**
 * 변수 화면에 보여줄 오류 문장. 서버가 준 코드(와 INVALID_INPUT 의 메시지)만 풀고, 값(평문)은 어디에도 싣지 않는다.
 * 모르는 오류는 describeError 가 서버 메시지를 그대로 보여준다(영어).
 */
export function describeVariablesError(error: unknown, t: (key: MessageKey, vars?: Vars) => string): string {
  // 응답을 받지 못했다(연결 끊김 등).
  if (!(error instanceof ApiError)) return t('service.vars.err.network');
  switch (error.code) {
    case 'VARIABLE_CONFLICT': return t('service.vars.err.conflict');
    case 'VARIABLE_NOT_FOUND': return t('service.vars.err.notFound');
    case 'SERVICE_NOT_FOUND': return t('service.vars.err.serviceGone');
    case 'NOT_CONFIGURED': return t('service.vars.err.notConfigured');
    case 'VARIABLE_REFERENCE_INVALID': return t('stack.vars.err.referenceInvalid');
    case 'INVALID_INPUT': {
      const key = INVALID_INPUT_KEYS[error.message];
      if (key) return t(key);
      break;
    }
    case 'VALIDATION_ERROR': {
      const key = validationKey(error.details);
      if (key) return t(key);
      break;
    }
  }
  if (error.status >= 500) return t('service.vars.err.server');
  return describeError(error);
}

/**
 * Raw 저장이 실패한 이유. describeVariablesError 의 문구에 서버가 알려 준 줄(과 키)을 붙인다.
 * 서버가 아무것도 바꾸지 않고 거절한 422 면 그것도 알린다.
 */
export function describeRawError(error: unknown, t: (key: MessageKey, vars?: Vars) => string): string {
  const issues = error instanceof ApiError ? rawIssues(error.details) : [];
  // 서버 message 는 첫 위반의 것이라, 줄 사유가 더 구체적이면 그 문구를 쓴다.
  const first = issues[0];
  let text = first?.unclosedQuote ? t('service.vars.err.unclosedQuote') : first?.keyTooLong ? t('service.vars.err.keyTooLong') : describeVariablesError(error, t);
  if (issues.length > 0) {
    const where = issues.map((i) => t('service.vars.err.atLine', { line: i.line }) + (i.key ? ` (${i.key})` : '')).join(', ');
    text += ` [${where}]`;
  }
  if (error instanceof ApiError && error.status === 422) text += ` ${t('service.vars.err.nothingChanged')}`;
  return text;
}

/**
 * 서비스의 환경변수. 소유자에게는 서버가 평문 값을 주고, 바꿔도 실행 중인 앱은 그대로다(다음 배포·Restart 부터 반영).
 * 추가·수정·삭제는 성공하면 응답으로 목록을 고치고, 실패하면 던진다. Raw 저장은 서버가 돌려준 전체로 목록을 바꾼다.
 */
export function useServiceVariables(serviceId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api.getServiceVariables(serviceId, ctrl.signal).then(
      (data) => { if (!ctrl.signal.aborted) setLoaded({ serviceId, data }); },
      (error) => { if (!ctrl.signal.aborted) setLoaded({ serviceId, failure: { error } }); },
    );
    return () => ctrl.abort();
  }, [serviceId, attempt]);

  // 다른 서비스의 결과가 남아 있으면 아직 불러오는 중으로 본다.
  const current = loaded?.serviceId === serviceId ? loaded : null;
  const data = current?.data;

  /** 이미 받은 목록을 서버 기준으로 다시 맞춘다. 실패해도 화면은 그대로 둔다. */
  const refresh = useCallback(async () => {
    try {
      const fresh = await api.getServiceVariables(serviceId);
      setLoaded((prev) => (prev && prev.serviceId !== serviceId ? prev : { serviceId, data: fresh }));
    } catch {
      /* 화면의 목록을 그대로 둔다 */
    }
  }, [serviceId]);

  /** 쓰기 요청 하나. 서버가 없다·이미 있다고 답하면 우리 목록이 틀린 것이니 서버 기준으로 다시 받는다. */
  const write = useCallback(async <T,>(task: () => Promise<T>, apply: (list: api.ServiceVariablesDto, result: T) => api.ServiceVariablesDto): Promise<void> => {
    setBusy(true);
    try {
      const result = await task();
      // 쓰는 사이 다른 서비스로 옮겼다면 그 서비스의 화면을 덮지 않는다.
      setLoaded((prev) => (prev && prev.serviceId === serviceId && prev.data ? { serviceId, data: apply(prev.data, result) } : prev));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'VARIABLE_NOT_FOUND' || e.code === 'VARIABLE_CONFLICT')) void refresh();
      throw e;
    } finally {
      setBusy(false);
    }
  }, [serviceId, refresh]);

  const add = useCallback((key: string, value: string) =>
    write(() => api.createServiceVariable(serviceId, { key, value }), (d, v) => ({ ...d, variables: withVariable(d.variables, v) })), [serviceId, write]);
  const update = useCallback((key: string, value: string) =>
    write(() => api.updateServiceVariable(serviceId, key, { value }), (d, v) => ({ ...d, variables: withVariable(d.variables, v) })), [serviceId, write]);
  /** 값 대신 같은 프로젝트 서비스의 연결 정보를 가리키는 변수를 만들거나(없으면) 바꾼다(있으면). */
  const setReference = useCallback((key: string, reference: api.VariableReferenceDto, exists: boolean) =>
    write(
      () => (exists ? api.updateServiceVariable(serviceId, key, { reference }) : api.createServiceVariable(serviceId, { key, reference })),
      (d, v) => ({ ...d, variables: withVariable(d.variables, v) }),
    ), [serviceId, write]);
  const remove = useCallback((key: string) =>
    write(() => api.deleteServiceVariable(serviceId, key), (d) => ({ ...d, variables: withoutVariable(d.variables, key) })), [serviceId, write]);
  /** 텍스트에 없는 변수는 지운다. 형식이 틀린 줄이 있으면 서버가 422 를 주고 아무것도 바뀌지 않는다. */
  const replaceAll = useCallback((raw: string, keep: api.VariableDto[] = []) =>
    write(async () => {
      const fresh = await api.replaceServiceVariables(serviceId, raw);
      // 참조 변수는 Raw 텍스트에 없어서 서버가 지웠을 수 있다. 되살리고(이미 있으면 무시), 최종 목록을 다시 받는다.
      const missing = keep.filter((k) => k.reference && !fresh.variables.some((v) => v.key === k.key));
      if (missing.length === 0) return fresh;
      await Promise.all(missing.map((k) => api.createServiceVariable(serviceId, { key: k.key, reference: k.reference! }).catch(() => undefined)));
      return api.getServiceVariables(serviceId);
    }, (_, fresh) => fresh), [serviceId, write]);

  return {
    loading: !current,
    /** 목록을 받지 못한 이유. 화면이 describeVariablesError 로 푼다. */
    error: current?.failure ?? null,
    retry: () => { setLoaded(null); setAttempt((n) => n + 1); },
    ready: !!data,
    variables: data?.variables ?? [],
    systemVariables: data?.systemVariables ?? [],
    busy, add, update, setReference, remove, replaceAll,
  };
}

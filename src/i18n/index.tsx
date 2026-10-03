import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext } from './context';
import * as create from './areas/create';
import * as diagnosis from './areas/diagnosis';
import * as project from './areas/project';
import * as service from './areas/service';
import * as svcSettings from './areas/svcSettings';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';

export const LANGS = { ko: '한국어', ja: '日本語', en: 'English' } as const;
export type Lang = keyof typeof LANGS;
// 공통 사전(ko/ja/en.ts) + 영역별 사전(areas/*.ts). 영역 파일은 각자 접두사를 써서 키가 겹치지 않는다.
const AREAS = [create, diagnosis, project, service, svcSettings];
const koAll = Object.assign({}, ko, ...AREAS.map((a) => a.ko)) as typeof ko &
  typeof create.ko & typeof diagnosis.ko & typeof project.ko & typeof service.ko & typeof svcSettings.ko;

export type MessageKey = keyof typeof koAll;
export type Messages = Record<MessageKey, string>;
export type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Messages> = {
  ko: koAll,
  ja: Object.assign({}, ja, ...AREAS.map((a) => a.ja)),
  en: Object.assign({}, en, ...AREAS.map((a) => a.en)),
};
const KEY = 'll:lang';

/** 저장된 언어 → 브라우저 언어 → 한국어 순으로 고른다. */
function initialLang(): Lang {
  const saved = localStorage.getItem(KEY);
  if (saved && saved in LANGS) return saved as Lang;
  const nav = navigator.language.slice(0, 2);
  return nav === 'ja' || nav === 'en' ? nav : 'ko';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // <html lang> 을 맞춰야 스크린 리더와 :lang(ja) 폰트 규칙이 따라온다.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      let s = DICTS[lang][key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "3시간 전" / "3時間前" / "3 hours ago". */
export function formatAgo(iso: string, lang: Lang, now = Date.now()): string {
  const sec = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  for (const [unit, size] of UNITS) if (sec >= size) return rtf.format(-Math.floor(sec / size), unit);
  return rtf.format(0, 'second');
}

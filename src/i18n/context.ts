import { createContext } from 'react';
import type { Lang, MessageKey, Vars } from './index';

export type I18n = { lang: Lang; setLang: (lang: Lang) => void; t: (key: MessageKey, vars?: Vars) => string };

export const I18nContext = createContext<I18n | null>(null);

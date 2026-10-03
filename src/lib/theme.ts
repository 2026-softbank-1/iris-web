export type Theme = 'light' | 'dark';

const KEY = 'll:theme';

/** 현재 테마. <html data-theme> 이 기준이다. */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** 첫 렌더 전에 저장된 테마를 적용한다. 기본은 라이트. */
export function initTheme() {
  document.documentElement.dataset.theme = localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

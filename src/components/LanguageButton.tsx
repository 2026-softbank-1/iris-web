import { Globe } from 'lucide-react';
import { LANGS, useI18n, type Lang } from '../i18n';
import { Popover, Tooltip, usePopover } from './ui';

/** 지구본 아이콘 버튼. 누르면 언어 목록이 열린다. */
export function LanguageButton() {
  const { lang, setLang, t } = useI18n();
  const pop = usePopover();
  return (
    <>
      <Tooltip label={t('lang.label')} side="bottom">
        <button
          type="button"
          aria-label={t('lang.label')}
          aria-haspopup="menu"
          className="icon-btn"
          data-state={pop.isOpen ? 'open' : 'closed'}
          onClick={(e) => pop.toggle(e.currentTarget)}
        >
          <Globe size={16} strokeWidth={2} />
        </button>
      </Tooltip>
      <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={128} className="menu lang-menu">
        {(Object.keys(LANGS) as Lang[]).map((code) => (
          <button
            key={code}
            type="button"
            className="menu-item"
            data-active={lang === code}
            aria-current={lang === code}
            lang={code}
            onClick={() => {
              setLang(code);
              pop.close();
            }}
          >
            {LANGS[code]}
          </button>
        ))}
      </Popover>
    </>
  );
}

import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * Bottom tab bar. items: [{ key, label, icon }]. Selected tab turns blue.
 */
export function TabBar({ items = [], value, onChange, style = {} }) {
  return (
    <nav style={{
      display: 'flex', background: 'var(--bg-default)', borderTop: '1px solid var(--border-default)',
      padding: '6px 0 max(6px, env(safe-area-inset-bottom))', ...style,
    }}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button key={it.key} type="button" onClick={() => onChange && onChange(it.key)}
            style={{
              flex: 1, border: 'none', background: 'none', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '6px 0', cursor: 'pointer',
              color: active ? 'var(--blue-500)' : 'var(--grey-400)', WebkitTapHighlightColor: 'transparent',
              transition: 'color var(--duration-fast)',
            }}>
            <Icon name={it.icon} size={26} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: '-0.01em' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

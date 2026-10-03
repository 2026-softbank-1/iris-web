import React from 'react';

/** Top tab strip with an animated underline indicator. */
export function Tabs({ items = [], value, onChange, fluid = false, style = {} }) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid var(--border-default)',
      gap: fluid ? 0 : 20, padding: fluid ? 0 : '0 4px', ...style,
    }}>
      {items.map((it) => {
        const key = it.key ?? it; const label = it.label ?? it;
        const active = key === value;
        return (
          <button key={key} type="button" onClick={() => onChange && onChange(key)}
            style={{
              flex: fluid ? 1 : 'none', border: 'none', background: 'none', cursor: 'pointer',
              padding: '14px 4px 13px', position: 'relative', fontFamily: 'var(--font-sans)',
              fontSize: 16, fontWeight: active ? 700 : 500,
              color: active ? 'var(--text-strong)' : 'var(--text-quaternary)',
              letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent',
              transition: 'color var(--duration-fast)',
            }}>
            {label}
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2,
              background: 'var(--grey-900)', transform: active ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform var(--duration-base) var(--ease-out)',
            }} />
          </button>
        );
      })}
    </div>
  );
}

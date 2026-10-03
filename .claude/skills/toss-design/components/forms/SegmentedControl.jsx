import React from 'react';

/** iOS-style segmented control: grey track, selected segment floats white. */
export function SegmentedControl({ options = [], value, onChange, style = {}, ...rest }) {
  const idx = Math.max(0, options.findIndex((o) => (o.value ?? o) === value));
  const n = options.length || 1;
  return (
    <div
      style={{
        position: 'relative', display: 'flex', background: 'var(--grey-100)',
        borderRadius: 12, padding: 4, ...style,
      }}
      {...rest}
    >
      <span style={{
        position: 'absolute', top: 4, bottom: 4, left: `calc(${(idx / n) * 100}% + 4px)`,
        width: `calc(${100 / n}% - 8px)`, background: '#fff', borderRadius: 9,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)', transition: 'left var(--duration-base) var(--ease-out)',
      }} />
      {options.map((o) => {
        const v = o.value ?? o; const l = o.label ?? o;
        const active = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange && onChange(v)}
            style={{
              position: 'relative', zIndex: 1, flex: 1, border: 'none', background: 'none',
              padding: '9px 0', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14,
              fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-quaternary)',
              letterSpacing: '-0.01em', transition: 'color var(--duration-fast)', WebkitTapHighlightColor: 'transparent',
            }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

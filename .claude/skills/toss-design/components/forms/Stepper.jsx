import React from 'react';

/** Numeric stepper: round −/+ buttons around a value (quantities, counts). */
export function Stepper({ value = 0, onChange, min = 0, max = 99, step = 1, disabled = false, style = {}, ...rest }) {
  const set = (v) => { const n = Math.min(max, Math.max(min, v)); onChange && onChange(n); };
  const btn = (label, onClick, off) => (
    <button type="button" disabled={disabled || off} onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
        background: 'var(--grey-100)', color: off ? 'var(--grey-300)' : 'var(--grey-700)',
        fontSize: 22, fontWeight: 500, lineHeight: 1, cursor: (disabled || off) ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
        transition: 'transform var(--duration-fast)', padding: 0,
      }}
      onPointerDown={(e) => !(disabled || off) && (e.currentTarget.style.transform = 'scale(0.9)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >{label}</button>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, ...style }} {...rest}>
      {btn('−', () => set(value - step), value <= min)}
      <span style={{ minWidth: 24, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
      {btn('+', () => set(value + step), value >= max)}
    </div>
  );
}

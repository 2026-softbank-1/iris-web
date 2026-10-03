import React from 'react';

/** Checkbox. `shape="circle"` is the Toss agree/consent style; "square" for lists. */
export function Checkbox({ checked = false, onChange, shape = 'square', size = 24, disabled = false, label, style = {}, ...rest }) {
  const box = (
    <span
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: shape === 'circle' ? '50%' : 7,
        background: checked ? 'var(--blue-500)' : 'var(--grey-200)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background var(--duration-fast)',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke={checked ? '#fff' : 'var(--grey-400)'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  if (!label) {
    return (
      <button type="button" aria-checked={checked} role="checkbox" disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{ border: 'none', background: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }} {...rest}>
        {box}
      </button>
    );
  }
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}>
      <button type="button" aria-checked={checked} role="checkbox" disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'inherit' }} {...rest}>
        {box}
      </button>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{label}</span>
    </label>
  );
}

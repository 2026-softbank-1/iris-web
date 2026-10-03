import React from 'react';

/** Pill toggle. On = Toss blue, off = grey. White knob slides. */
export function Switch({ checked = false, onChange, disabled = false, style = {}, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: 52, height: 32, borderRadius: 999, border: 'none', position: 'relative',
        background: checked ? 'var(--blue-500)' : 'var(--grey-300)',
        cursor: disabled ? 'not-allowed' : 'pointer', padding: 0, flexShrink: 0,
        transition: 'background var(--duration-base) var(--ease-standard)',
        opacity: disabled ? 0.5 : 1, WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      {...rest}
    >
      <span style={{
        position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: '50%',
        background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform var(--duration-base) var(--ease-out)',
      }} />
    </button>
  );
}

import React from 'react';

export function Chip({
  children,
  selected = false,
  size = 'medium',
  leadingIcon = null,
  trailingIcon = null,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const h = size === 'small' ? 32 : 38;
  const fs = size === 'small' ? 13 : 14;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: h,
        padding: size === 'small' ? '0 12px' : '0 14px',
        borderRadius: 999,
        fontFamily: 'var(--font-sans)',
        fontSize: fs,
        fontWeight: selected ? 600 : 500,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all var(--duration-fast) var(--ease-standard)',
        WebkitTapHighlightColor: 'transparent',
        border: selected ? '1px solid var(--blue-500)' : '1px solid var(--border-default)',
        background: selected ? 'var(--fill-brand-weak)' : 'var(--bg-default)',
        color: selected ? 'var(--blue-600)' : 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

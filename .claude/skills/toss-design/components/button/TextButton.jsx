import React from 'react';

const TB_SIZES = { large: 17, medium: 15, small: 13 };
const TB_COLORS = {
  brand:   'var(--blue-600)',
  neutral: 'var(--text-tertiary)',
  strong:  'var(--text-primary)',
  danger:  'var(--red-600)',
};

export function TextButton({
  children,
  size = 'medium',
  color = 'neutral',
  underline = false,
  arrow = false,
  disabled = false,
  style = {},
  ...rest
}) {
  const fs = TB_SIZES[size] || 15;
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        border: 'none',
        background: 'none',
        padding: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: TB_COLORS[color] || TB_COLORS.neutral,
        textDecoration: underline ? 'underline' : 'none',
        textUnderlineOffset: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity var(--duration-fast)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.opacity = '0.5')}
      onPointerUp={(e) => (e.currentTarget.style.opacity = disabled ? '0.4' : '1')}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = disabled ? '0.4' : '1')}
      {...rest}
    >
      {children}
      {arrow && (
        <svg width={fs - 3} height={fs - 3} viewBox="0 0 24 24" fill="none" style={{ marginTop: 1 }}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

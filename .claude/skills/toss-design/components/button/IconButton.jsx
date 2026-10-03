import React from 'react';

const IB_SIZES = { small: 32, medium: 40, large: 48 };

export function IconButton({
  children,
  size = 'medium',
  variant = 'ghost',
  disabled = false,
  'aria-label': ariaLabel = 'button',
  style = {},
  ...rest
}) {
  const dim = IB_SIZES[size] || 40;
  const bg = variant === 'weak' ? 'var(--fill-neutral-weak)'
    : variant === 'fill' ? 'var(--blue-500)' : 'transparent';
  const color = variant === 'fill' ? '#fff' : 'var(--icon-default)';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: variant === 'ghost' ? '50%' : 12,
        border: 'none',
        background: bg,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'transform var(--duration-fast), background var(--duration-fast)',
        WebkitTapHighlightColor: 'transparent',
        padding: 0,
        ...style,
      }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.9)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      {...rest}
    >
      {children}
    </button>
  );
}

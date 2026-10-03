import React from 'react';

const SIZES = {
  large:  { height: 56, padding: '0 20px', radius: 16, font: 17, weight: 600 },
  medium: { height: 48, padding: '0 18px', radius: 14, font: 15, weight: 600 },
  small:  { height: 40, padding: '0 14px', radius: 12, font: 14, weight: 600 },
  tiny:   { height: 32, padding: '0 12px', radius: 10, font: 13, weight: 600 },
};

// color → { fill bg, fill text, weak bg, weak text }
const COLORS = {
  brand:   { fill: 'var(--blue-500)',  fillText: '#fff', weak: 'var(--fill-brand-weak)',   weakText: 'var(--blue-600)',  press: 'var(--blue-600)' },
  neutral: { fill: 'var(--grey-800)',  fillText: '#fff', weak: 'var(--fill-neutral-weak)', weakText: 'var(--grey-800)',  press: 'var(--grey-900)' },
  danger:  { fill: 'var(--red-500)',   fillText: '#fff', weak: 'var(--fill-danger-weak)',  weakText: 'var(--red-600)',   press: 'var(--red-600)' },
  dark:    { fill: 'var(--grey-900)',  fillText: '#fff', weak: 'rgba(7,25,76,0.05)',       weakText: 'var(--grey-900)',  press: '#000' },
};

export function Button({
  children,
  variant = 'fill',
  color = 'brand',
  size = 'large',
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  style = {},
  ...rest
}) {
  const s = SIZES[size] || SIZES.large;
  const c = COLORS[color] || COLORS.brand;
  const isWeak = variant === 'weak';
  const isOutline = variant === 'outline';
  const isDisabled = disabled || loading;

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: fullWidth ? '100%' : 'auto',
    height: s.height,
    padding: s.padding,
    borderRadius: s.radius,
    border: isOutline ? '1px solid var(--border-strong)' : 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: s.font,
    fontWeight: s.weight,
    lineHeight: 1,
    letterSpacing: '-0.01em',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'transform var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard), opacity var(--duration-fast)',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    boxSizing: 'border-box',
    background: isOutline ? 'transparent' : (isWeak ? c.weak : c.fill),
    color: isOutline ? 'var(--text-secondary)' : (isWeak ? c.weakText : c.fillText),
    opacity: isDisabled ? 0.4 : 1,
    ...style,
  };

  const handleDown = (e) => { if (!isDisabled) e.currentTarget.style.transform = 'scale(var(--press-scale))'; };
  const handleUp = (e) => { e.currentTarget.style.transform = 'scale(1)'; };

  return (
    <button
      type="button"
      style={base}
      disabled={isDisabled}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      {...rest}
    >
      {loading ? (
        <span style={{
          width: s.font + 3, height: s.font + 3, borderRadius: '50%',
          border: '2px solid currentColor', borderTopColor: 'transparent',
          display: 'inline-block', animation: 'tds-spin 0.6s linear infinite', opacity: 0.9,
        }} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
      <style>{`@keyframes tds-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}

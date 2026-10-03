import React from 'react';

/**
 * The Toss workhorse row: optional left accessory, title + description,
 * optional right accessory (amount text, chevron, switch, badge…).
 */
export function ListRow({
  title,
  description,
  left = null,
  right = null,
  arrow = false,
  onClick,
  bold = true,
  style = {},
  ...rest
}) {
  const pressable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={pressable ? 'button' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
        cursor: pressable ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background var(--duration-fast)',
        ...style,
      }}
      onPointerDown={(e) => pressable && (e.currentTarget.style.background = 'var(--fill-pressed)')}
      onPointerUp={(e) => (e.currentTarget.style.background = 'transparent')}
      onPointerLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      {...rest}
    >
      {left && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{left}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: bold ? 600 : 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{title}</div>
        {description && (
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-quaternary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
            marginTop: 2,
          }}>{description}</div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{right}</div>}
      {arrow && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'var(--icon-tertiary)' }}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

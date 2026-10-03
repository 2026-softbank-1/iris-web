import React from 'react';

/** Generic white rounded surface — Toss groups content into soft cards. */
export function Card({ children, padding = 20, radius = 20, shadow = false, style = {}, ...rest }) {
  return (
    <div
      style={{
        background: 'var(--bg-default)',
        borderRadius: radius,
        padding,
        boxSizing: 'border-box',
        boxShadow: shadow ? 'var(--shadow-card)' : 'none',
        border: shadow ? 'none' : '1px solid var(--border-default)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

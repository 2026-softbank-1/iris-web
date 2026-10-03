import React from 'react';

/** Dark pill toast (bottom of screen). Optional leading icon + action. */
export function Toast({ children, icon = null, action = null, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: 360,
      background: 'rgba(31,38,48,0.94)', color: '#fff', borderRadius: 14,
      padding: '14px 18px', boxShadow: 'var(--shadow-float)', backdropFilter: 'blur(8px)',
      fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', ...style,
    }}>
      {icon && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{children}</span>
      {action && <span style={{ flexShrink: 0, color: 'var(--blue-300)', fontWeight: 600 }}>{action}</span>}
    </div>
  );
}

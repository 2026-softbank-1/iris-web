import React from 'react';

/** Centered modal dialog. title + message + 1–2 actions. Renders a scrim when open. */
export function Dialog({ open = true, title, children, primaryLabel = '확인', onPrimary, secondaryLabel, onSecondary, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg-dim)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        animation: 'tds-fade 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320, background: '#fff', borderRadius: 20, padding: '28px 24px 16px',
          boxShadow: 'var(--shadow-float)', animation: 'tds-pop 0.24s var(--ease-out)',
        }}
      >
        {title && <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', textAlign: 'center', letterSpacing: '-0.01em' }}>{title}</h3>}
        {children && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>{children}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {secondaryLabel && (
            <button type="button" onClick={onSecondary} style={btnStyle('var(--fill-neutral-weak)', 'var(--text-secondary)')}>{secondaryLabel}</button>
          )}
          <button type="button" onClick={onPrimary} style={btnStyle('var(--blue-500)', '#fff')}>{primaryLabel}</button>
        </div>
      </div>
      <style>{`@keyframes tds-fade{from{opacity:0}to{opacity:1}}@keyframes tds-pop{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
function btnStyle(bg, color) {
  return {
    flex: 1, height: 52, borderRadius: 14, border: 'none', background: bg, color,
    fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
    letterSpacing: '-0.01em', WebkitTapHighlightColor: 'transparent',
  };
}

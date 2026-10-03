import React from 'react';

/** Bottom sheet: handle, title, content, slides up from the bottom. */
export function BottomSheet({ open = true, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg-dim)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'tds-fade 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: '#fff',
          borderRadius: '24px 24px 0 0', padding: '12px 24px max(24px, env(safe-area-inset-bottom))',
          boxShadow: 'var(--shadow-sheet)', animation: 'tds-slide-up 0.3s var(--ease-out)',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--grey-200)', margin: '0 auto 20px' }} />
        {title && <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>{title}</h3>}
        {children}
      </div>
      <style>{`@keyframes tds-fade{from{opacity:0}to{opacity:1}}@keyframes tds-slide-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

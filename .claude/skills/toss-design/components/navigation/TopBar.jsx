import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** iOS/Android-style top navigation bar: back, title, right action. */
export function TopBar({ title, onBack, right = null, large = false, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-default)', ...style }}>
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 4px',
      }}>
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="back"
            style={{ width: 44, height: 44, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--grey-800)', WebkitTapHighlightColor: 'transparent' }}>
            <Icon name="arrow-left" size={26} />
          </button>
        ) : <span style={{ width: 12 }} />}
        {!large && (
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        )}
        {large && <span style={{ flex: 1 }} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{right}</div>
      </div>
      {large && (
        <h1 style={{ margin: 0, padding: '4px 24px 14px', fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.02em' }}>{title}</h1>
      )}
    </div>
  );
}

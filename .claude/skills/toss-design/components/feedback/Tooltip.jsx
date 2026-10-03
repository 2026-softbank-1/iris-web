import React from 'react';

/** Small dark tooltip bubble with a pointer. `placement` sets arrow side. */
export function Tooltip({ children, placement = 'top', color = 'var(--grey-900)', style = {} }) {
  const arrow = {
    position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
  };
  const arrows = {
    top:    { ...arrow, bottom: -6, left: '50%', transform: 'translateX(-50%)', borderWidth: '6px 6px 0 6px', borderColor: `${color} transparent transparent transparent` },
    bottom: { ...arrow, top: -6, left: '50%', transform: 'translateX(-50%)', borderWidth: '0 6px 6px 6px', borderColor: `transparent transparent ${color} transparent` },
  };
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...style }}>
      <span style={{
        display: 'inline-block', background: color, color: '#fff', borderRadius: 10,
        padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
        letterSpacing: '-0.01em', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-float)',
      }}>
        {children}
        <span style={arrows[placement] || arrows.top} />
      </span>
    </span>
  );
}

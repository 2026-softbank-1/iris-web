import React from 'react';

const BADGE_SIZES = {
  small:  { font: 11, pad: '2px 6px',  radius: 6 },
  medium: { font: 12, pad: '3px 8px',  radius: 7 },
  large:  { font: 13, pad: '4px 10px', radius: 8 },
};

const BADGE_COLORS = {
  grey:   { weakBg: 'rgba(2,32,71,0.05)',     weakText: 'var(--grey-700)',  fillBg: 'var(--grey-600)',  fillText: '#fff' },
  blue:   { weakBg: 'rgba(49,130,246,0.12)',  weakText: 'var(--blue-600)',  fillBg: 'var(--blue-500)',  fillText: '#fff' },
  red:    { weakBg: 'rgba(240,68,82,0.12)',   weakText: 'var(--red-600)',   fillBg: 'var(--red-500)',   fillText: '#fff' },
  green:  { weakBg: 'rgba(2,162,98,0.12)',    weakText: 'var(--text-success)', fillBg: 'var(--green-500)', fillText: '#fff' },
  teal:   { weakBg: 'rgba(43,196,196,0.14)',  weakText: '#1B8A8A',          fillBg: 'var(--teal-600)',  fillText: '#fff' },
  yellow: { weakBg: 'rgba(255,179,49,0.18)',  weakText: 'var(--grey-800)',  fillBg: 'var(--toss-yellow)', fillText: 'var(--grey-900)' },
};

export function Badge({ children, size = 'medium', color = 'grey', variant = 'weak', style = {}, ...rest }) {
  const s = BADGE_SIZES[size] || BADGE_SIZES.medium;
  const c = BADGE_COLORS[color] || BADGE_COLORS.grey;
  const fill = variant === 'fill';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: s.pad,
        borderRadius: s.radius,
        fontFamily: 'var(--font-sans)',
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        background: fill ? c.fillBg : c.weakBg,
        color: fill ? c.fillText : c.weakText,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

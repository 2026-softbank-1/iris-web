import React from 'react';

/** Thin rounded progress track with a blue fill. */
export function ProgressBar({ value = 0, max = 100, height = 8, color = 'var(--blue-500)', style = {} }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ width: '100%', height, background: 'var(--grey-200)', borderRadius: 999, overflow: 'hidden', ...style }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color, borderRadius: 999,
        transition: 'width var(--duration-base) var(--ease-out)',
      }} />
    </div>
  );
}

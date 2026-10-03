import React from 'react';

/** Circular spinner. Toss uses a thin blue ring. */
export function Loader({ size = 28, color = 'var(--blue-500)', stroke = 3, style = {} }) {
  return (
    <span
      role="status"
      aria-label="loading"
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        border: `${stroke}px solid var(--grey-200)`, borderTopColor: color,
        animation: 'tds-loader-spin 0.7s linear infinite', ...style,
      }}
    >
      <style>{`@keyframes tds-loader-spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

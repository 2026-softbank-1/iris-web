import React from 'react';

/**
 * Toss text field. `variant="box"` = filled grey rounded box (forms);
 * `variant="line"` = underline field (amounts, inline). Focus → blue,
 * error → red with message.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  variant = 'box',
  error = '',
  suffix = null,
  type = 'text',
  disabled = false,
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const accent = error ? 'var(--red-500)' : focused ? 'var(--blue-500)' : 'var(--border-strong)';
  const isBox = variant === 'box';

  return (
    <div style={{ width: '100%', ...style }}>
      {label && (
        <label style={{
          display: 'block', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
          color: error ? 'var(--red-600)' : 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '-0.01em',
        }}>{label}</label>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: isBox ? (disabled ? 'var(--grey-100)' : 'var(--grey-50)') : 'transparent',
        border: isBox ? `1px solid ${error ? 'var(--red-500)' : focused ? 'var(--blue-500)' : 'var(--border-default)'}` : 'none',
        borderBottom: isBox ? undefined : `2px solid ${accent}`,
        borderRadius: isBox ? 14 : 0,
        padding: isBox ? '0 16px' : '0 0 8px',
        height: isBox ? 54 : 'auto',
        transition: 'border-color var(--duration-fast)',
        opacity: disabled ? 0.5 : 1,
      }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-sans)', fontSize: variant === 'line' ? 20 : 16,
            fontWeight: variant === 'line' ? 700 : 500, color: 'var(--text-primary)',
            letterSpacing: '-0.01em', padding: 0,
          }}
          {...rest}
        />
        {suffix && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-quaternary)' }}>{suffix}</span>}
      </div>
      {error && (
        <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--red-600)' }}>{error}</p>
      )}
    </div>
  );
}

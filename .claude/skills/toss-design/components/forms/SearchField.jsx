import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Rounded grey search box with leading magnifier + clear button. */
export function SearchField({ value, onChange, placeholder = '검색', onClear, style = {}, ...rest }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, height: 48,
      background: 'var(--grey-100)', borderRadius: 14, padding: '0 14px', ...style,
    }}>
      <Icon name="search" size={20} color="var(--icon-tertiary)" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="clear"
          style={{
            border: 'none', background: 'var(--grey-300)', borderRadius: '50%', width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        >
          <Icon name="x" size={12} color="#fff" />
        </button>
      )}
    </div>
  );
}

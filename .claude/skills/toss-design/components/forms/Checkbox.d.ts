import * as React from 'react';
/** Checkbox. circle = consent/agree style, square = list selection. */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  shape?: 'square' | 'circle';
  size?: number;
  disabled?: boolean;
  label?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

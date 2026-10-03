import * as React from 'react';
/** Pill-shaped filter/selection chip. Toggles a blue selected state. */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  selected?: boolean;
  size?: 'small' | 'medium';
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}
export declare function Chip(props: ChipProps): JSX.Element;

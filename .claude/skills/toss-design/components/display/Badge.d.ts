import * as React from 'react';
/** Small status/category label. Weak (tinted) is the Toss default. */
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  color?: 'grey' | 'blue' | 'red' | 'green' | 'teal' | 'yellow';
  variant?: 'weak' | 'fill';
}
export declare function Badge(props: BadgeProps): JSX.Element;

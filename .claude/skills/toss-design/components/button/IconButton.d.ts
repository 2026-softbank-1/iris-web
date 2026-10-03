import * as React from 'react';
/** Square/circular button holding a single icon (e.g. nav-bar actions). */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  variant?: 'ghost' | 'weak' | 'fill';
  'aria-label'?: string;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

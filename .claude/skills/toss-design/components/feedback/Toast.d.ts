import * as React from 'react';
/** Dark pill toast shown at the bottom of the screen. */
export interface ToastProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;

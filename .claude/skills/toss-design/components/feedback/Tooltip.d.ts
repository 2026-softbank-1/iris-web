import * as React from 'react';
/** Small dark tooltip bubble with a pointer arrow. */
export interface TooltipProps {
  children?: React.ReactNode;
  placement?: 'top' | 'bottom';
  color?: string;
  style?: React.CSSProperties;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;

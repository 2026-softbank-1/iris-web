import * as React from 'react';
/** Thin rounded progress bar with blue fill. */
export interface ProgressBarProps {
  value?: number;
  max?: number;
  height?: number;
  color?: string;
  style?: React.CSSProperties;
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;

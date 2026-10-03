import * as React from 'react';
/** iOS-style segmented control with a sliding white selector. */
export interface SegmentedControlProps {
  /** string[] or {label,value}[]. */
  options: Array<string | { label: React.ReactNode; value: string }>;
  value: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;

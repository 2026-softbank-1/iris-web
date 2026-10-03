import * as React from 'react';
/** Top navigation bar. Set `large` for the iOS large-title style. */
export interface TopBarProps {
  title?: React.ReactNode;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;

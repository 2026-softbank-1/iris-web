import * as React from 'react';
/** Top tab strip with an animated underline. `fluid` spreads tabs full-width. */
export interface TabsProps {
  items: Array<string | { key: string; label: React.ReactNode }>;
  value: string;
  onChange?: (key: string) => void;
  fluid?: boolean;
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;

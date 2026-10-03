import * as React from 'react';
/** Bottom tab bar; selected tab turns Toss blue. */
export interface TabBarItem { key: string; label: React.ReactNode; icon: string; }
export interface TabBarProps {
  items: TabBarItem[];
  value: string;
  onChange?: (key: string) => void;
  style?: React.CSSProperties;
}
export declare function TabBar(props: TabBarProps): JSX.Element;

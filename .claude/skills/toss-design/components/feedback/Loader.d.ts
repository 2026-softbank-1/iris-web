import * as React from 'react';
/** Circular loading spinner (thin blue ring). */
export interface LoaderProps {
  size?: number;
  color?: string;
  stroke?: number;
  style?: React.CSSProperties;
}
export declare function Loader(props: LoaderProps): JSX.Element;

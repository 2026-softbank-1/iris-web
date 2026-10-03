import * as React from 'react';
/** Soft white container that groups content into a Toss "card". */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  padding?: number;
  radius?: number;
  /** Float on a soft shadow instead of a hairline border. */
  shadow?: boolean;
}
export declare function Card(props: CardProps): JSX.Element;

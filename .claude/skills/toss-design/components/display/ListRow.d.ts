import * as React from 'react';
/**
 * List row primitive — the backbone of Toss list screens (accounts,
 * settings, transactions). Compose any left/right accessory.
 */
export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Left accessory: icon tile, avatar, or image. */
  left?: React.ReactNode;
  /** Right accessory: amount text, badge, switch, button… */
  right?: React.ReactNode;
  /** Trailing chevron for navigational rows. */
  arrow?: boolean;
  bold?: boolean;
  onClick?: React.MouseEventHandler;
}
export declare function ListRow(props: ListRowProps): JSX.Element;

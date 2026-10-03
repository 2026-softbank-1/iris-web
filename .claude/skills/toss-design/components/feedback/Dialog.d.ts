import * as React from 'react';
/** Centered modal dialog with title, message and 1–2 actions. */
export interface DialogProps {
  open?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;

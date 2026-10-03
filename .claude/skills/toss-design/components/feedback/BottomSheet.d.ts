import * as React from 'react';
/** Bottom sheet with a drag handle; slides up from the bottom edge. */
export interface BottomSheetProps {
  open?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
}
export declare function BottomSheet(props: BottomSheetProps): JSX.Element | null;

import * as React from 'react';
/** Grey rounded search box with magnifier + clear. */
export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  onClear?: () => void;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;

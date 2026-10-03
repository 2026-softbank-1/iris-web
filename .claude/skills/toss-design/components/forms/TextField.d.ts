import * as React from 'react';
/** Text input. box = filled rounded form field; line = underline (amounts). */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: React.ReactNode;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  variant?: 'box' | 'line';
  error?: string;
  suffix?: React.ReactNode;
  disabled?: boolean;
}
export declare function TextField(props: TextFieldProps): JSX.Element;

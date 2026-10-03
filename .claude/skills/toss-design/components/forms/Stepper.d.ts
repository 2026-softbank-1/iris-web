import * as React from 'react';
/** Round −/+ numeric stepper for quantities. */
export interface StepperProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Stepper(props: StepperProps): JSX.Element;

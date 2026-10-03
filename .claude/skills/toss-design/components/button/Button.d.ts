import * as React from 'react';

/**
 * Toss primary action button. Fill for the single most important action on a
 * screen (usually a full-width bottom CTA); weak/outline for secondary actions.
 *
 * @startingPoint section="Buttons" subtitle="Primary CTA, weak & color variants" viewport="700x180"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: React.ReactNode;
  /** Visual treatment. fill = solid, weak = tinted, outline = bordered. */
  variant?: 'fill' | 'weak' | 'outline';
  /** Semantic color. */
  color?: 'brand' | 'neutral' | 'danger' | 'dark';
  size?: 'large' | 'medium' | 'small' | 'tiny';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;

import * as React from 'react';
/**
 * Inline, chrome-less text action — "더보기", "전체 보기", "다음" links.
 * Set `arrow` for the trailing chevron Toss uses on "see more" rows.
 */
export interface TextButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  children?: React.ReactNode;
  size?: 'large' | 'medium' | 'small';
  color?: 'brand' | 'neutral' | 'strong' | 'danger';
  underline?: boolean;
  arrow?: boolean;
}
export declare function TextButton(props: TextButtonProps): JSX.Element;

/* Button, portado de bundle.js. Quatro variantes, primario neutro. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './tipos';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'touch';
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size,
  block,
  icon,
  className,
  children,
  type,
  disabled,
  ...resto
}: ButtonProps) {
  return (
    <button
      {...resto}
      type={type ?? 'button'}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={cx(
        'gf-btn',
        'gf-btn-' + variant,
        size === 'touch' && 'gf-btn-touch',
        block && 'gf-btn-block',
        'body-strong',
        className
      )}
    >
      {icon ?? null}
      {children}
    </button>
  );
}

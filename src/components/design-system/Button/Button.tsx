/**
 * Button Component
 *
 * 核心按钮组件，支持多种变体和状态
 *
 * @example
 * <Button variant="primary" size="md">点击我</Button>
 * <Button variant="secondary" loading>加载中</Button>
 * <Button variant="ghost" icon={<Icon />}>带图标</Button>
 */

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 加载状态 */
  loading?: boolean;
  /** 前置图标 */
  icon?: ReactNode;
  /** 后置图标 */
  iconRight?: ReactNode;
  /** 全宽按钮 */
  fullWidth?: boolean;
  /** 子元素 */
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={clsx(
          styles.button,
          styles[`button--${variant}`],
          styles[`button--${size}`],
          fullWidth && styles['button--full-width'],
          loading && styles['button--loading'],
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span className={styles.button__spinner} aria-label="加载中">
            <svg
              className={styles.spinner}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className={styles.spinner__circle}
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
          </span>
        )}

        {!loading && icon && <span className={styles.button__icon}>{icon}</span>}

        {children && <span className={styles.button__text}>{children}</span>}

        {!loading && iconRight && (
          <span className={styles.button__icon}>{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

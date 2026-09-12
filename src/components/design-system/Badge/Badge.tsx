/**
 * Badge Component
 *
 * 徽章组件，用于显示状态、计数等信息
 *
 * @example
 * <Badge variant="success">成功</Badge>
 * <Badge variant="warning" size="sm">待审批</Badge>
 */

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 徽章变体 */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  /** 徽章尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否圆点样式 */
  dot?: boolean;
  /** 子元素 */
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      dot = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={clsx(
          styles.badge,
          styles[`badge--${variant}`],
          styles[`badge--${size}`],
          dot && styles['badge--dot'],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

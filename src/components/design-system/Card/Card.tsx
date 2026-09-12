/**
 * Card Component
 *
 * 基础卡片组件，用于承载内容
 *
 * @example
 * <Card>
 *   <CardHeader>标题</CardHeader>
 *   <CardContent>内容</CardContent>
 *   <CardFooter>底部</CardFooter>
 * </Card>
 */

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 卡片变体 */
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 是否可交互（hover 效果） */
  interactive?: boolean;
  /** 子元素 */
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          styles.card,
          styles[`card--${variant}`],
          styles[`card--padding-${padding}`],
          interactive && styles['card--interactive'],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/* ==================== CardHeader ==================== */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx(styles.card__header, className)} {...props}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

/* ==================== CardContent ==================== */

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx(styles.card__content, className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

/* ==================== CardFooter ==================== */

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx(styles.card__footer, className)} {...props}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

import { forwardRef, type HTMLAttributes } from 'react';

/**
 * Badge 变体
 */
type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Badge 尺寸
 */
type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * 徽章变体
   * @default 'default'
   */
  variant?: BadgeVariant;

  /**
   * 徽章尺寸
   * @default 'md'
   */
  size?: BadgeSize;

  /**
   * 是否显示圆点
   */
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-700',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

/**
 * Badge 组件
 *
 * 设计系统的标准徽章组件
 *
 * @example
 * ```tsx
 * <Badge variant="primary">新功能</Badge>
 * <Badge variant="success" dot>已完成</Badge>
 * <Badge variant="warning" size="sm">待处理</Badge>
 * ```
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      dot = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const badgeStyles = [
      // 基础样式
      'inline-flex items-center gap-1.5',
      'rounded-full font-semibold',
      'transition-colors duration-200',

      // 变体和尺寸
      variantStyles[variant],
      sizeStyles[size],

      // 自定义类名
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={badgeStyles} {...props}>
        {dot && (
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              dotColors[variant],
            ].join(' ')}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';

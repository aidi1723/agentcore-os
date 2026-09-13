import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button 变体
 */
type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'link';

/**
 * Button 尺寸
 */
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 按钮变体
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * 按钮尺寸
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * 加载状态
   */
  loading?: boolean;

  /**
   * 左侧图标
   */
  icon?: ReactNode;

  /**
   * 右侧图标
   */
  iconRight?: ReactNode;

  /**
   * 全宽按钮
   */
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 disabled:bg-gray-300 disabled:text-gray-500',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 disabled:text-gray-500',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-400',
  link:
    'bg-transparent text-blue-600 hover:text-blue-700 active:text-blue-800 underline-offset-4 hover:underline disabled:text-gray-400 disabled:no-underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

/**
 * Button 组件
 *
 * 设计系统的标准按钮组件
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   点击我
 * </Button>
 *
 * <Button variant="secondary" loading>
 *   加载中...
 * </Button>
 *
 * <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}>
 *   删除
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const baseStyles = [
      // 基础样式
      'inline-flex items-center justify-center gap-2',
      'rounded-xl font-semibold',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',

      // 禁用样式
      'disabled:cursor-not-allowed disabled:shadow-none',

      // 宽度
      fullWidth ? 'w-full' : '',

      // 变体和尺寸
      variantStyles[variant],
      sizeStyles[size],

      // 自定义类名
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={baseStyles}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          <span className="inline-flex shrink-0">{icon}</span>
        ) : null}

        {children && <span>{children}</span>}

        {!loading && iconRight ? (
          <span className="inline-flex shrink-0">{iconRight}</span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = 'Button';

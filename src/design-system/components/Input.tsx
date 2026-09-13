import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Input 尺寸
 */
type InputSize = 'sm' | 'md' | 'lg';

/**
 * Input 状态
 */
type InputState = 'default' | 'error' | 'success';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * 输入框尺寸
   * @default 'md'
   */
  inputSize?: InputSize;

  /**
   * 输入框状态
   * @default 'default'
   */
  state?: InputState;

  /**
   * 标签文字
   */
  label?: string;

  /**
   * 是否必填
   */
  required?: boolean;

  /**
   * 帮助文本
   */
  helperText?: string;

  /**
   * 错误文本
   */
  errorText?: string;

  /**
   * 左侧图标
   */
  iconLeft?: ReactNode;

  /**
   * 右侧图标
   */
  iconRight?: ReactNode;

  /**
   * 全宽输入框
   */
  fullWidth?: boolean;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

const stateStyles: Record<InputState, string> = {
  default:
    'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
  error:
    'border-red-300 focus:border-red-500 focus:ring-red-500',
  success:
    'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500',
};

/**
 * Input 组件
 *
 * 设计系统的标准输入框组件
 *
 * @example
 * ```tsx
 * <Input
 *   label="用户名"
 *   placeholder="请输入用户名"
 *   required
 * />
 *
 * <Input
 *   label="邮箱"
 *   type="email"
 *   state="error"
 *   errorText="邮箱格式不正确"
 * />
 *
 * <Input
 *   iconLeft={<Search className="h-4 w-4" />}
 *   placeholder="搜索..."
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputSize = 'md',
      state = 'default',
      label,
      required = false,
      helperText,
      errorText,
      iconLeft,
      iconRight,
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = props.id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const hasError = state === 'error' || Boolean(errorText);
    const finalState = hasError ? 'error' : state;
    const displayHelperText = errorText || helperText;

    const inputStyles = [
      // 基础样式
      'w-full rounded-xl border bg-white text-gray-900',
      'transition-colors duration-200',
      'placeholder:text-gray-400',

      // 焦点样式
      'focus:outline-none focus:ring-2',

      // 禁用样式
      'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',

      // 尺寸和状态
      sizeStyles[inputSize],
      stateStyles[finalState],

      // 图标内边距调整
      iconLeft ? 'pl-10' : '',
      iconRight ? 'pr-10' : '',

      // 自定义类名
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-xs font-semibold text-gray-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* 左侧图标 */}
          {iconLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              {iconLeft}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={inputStyles}
            aria-invalid={hasError}
            aria-describedby={displayHelperText ? `${inputId}-helper` : undefined}
            {...props}
          />

          {/* 右侧图标 */}
          {iconRight && !hasError && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              {iconRight}
            </div>
          )}

          {/* 错误图标 */}
          {hasError && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-red-500">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Helper/Error Text */}
        {displayHelperText && (
          <p
            id={`${inputId}-helper`}
            className={[
              'mt-1.5 text-xs',
              hasError ? 'text-red-600' : 'text-gray-500',
            ].join(' ')}
          >
            {displayHelperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

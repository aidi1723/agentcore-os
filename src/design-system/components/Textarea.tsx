import { forwardRef, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Textarea 尺寸
 */
type TextareaSize = 'sm' | 'md' | 'lg';

/**
 * Textarea 状态
 */
type TextareaState = 'default' | 'error' | 'success';

/**
 * Textarea 自动调整高度模式
 */
type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * 文本框尺寸
   * @default 'md'
   */
  textareaSize?: TextareaSize;

  /**
   * 文本框状态
   * @default 'default'
   */
  state?: TextareaState;

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
   * 全宽文本框
   */
  fullWidth?: boolean;

  /**
   * 调整大小模式
   * @default 'vertical'
   */
  resize?: TextareaResize;

  /**
   * 显示字符计数
   */
  showCount?: boolean;

  /**
   * 最大字符数
   */
  maxLength?: number;
}

const sizeStyles: Record<TextareaSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base',
};

const stateStyles: Record<TextareaState, string> = {
  default:
    'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
  error:
    'border-red-300 focus:border-red-500 focus:ring-red-500',
  success:
    'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500',
};

const resizeStyles: Record<TextareaResize, string> = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
};

/**
 * Textarea 组件
 *
 * 设计系统的标准文本域组件
 *
 * @example
 * ```tsx
 * <Textarea
 *   label="描述"
 *   placeholder="请输入描述"
 *   rows={4}
 * />
 *
 * <Textarea
 *   label="备注"
 *   state="error"
 *   errorText="内容不能为空"
 * />
 *
 * <Textarea
 *   showCount
 *   maxLength={200}
 *   placeholder="最多200字"
 * />
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      textareaSize = 'md',
      state = 'default',
      label,
      required = false,
      helperText,
      errorText,
      fullWidth = false,
      resize = 'vertical',
      showCount = false,
      maxLength,
      className = '',
      disabled,
      value,
      ...props
    },
    ref,
  ) => {
    const textareaId = props.id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const hasError = state === 'error' || Boolean(errorText);
    const finalState = hasError ? 'error' : state;
    const displayHelperText = errorText || helperText;

    // 计算当前字符数
    const currentLength = typeof value === 'string' ? value.length : 0;
    const showCounter = showCount && maxLength !== undefined;

    const textareaStyles = [
      // 基础样式
      'w-full rounded-2xl border bg-white text-gray-900',
      'transition-colors duration-200',
      'placeholder:text-gray-400',

      // 焦点样式
      'focus:outline-none focus:ring-2',

      // 禁用样式
      'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',

      // 尺寸、状态、调整大小
      sizeStyles[textareaSize],
      stateStyles[finalState],
      resizeStyles[resize],

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
            htmlFor={textareaId}
            className="mb-2 block text-xs font-semibold text-gray-700"
          >
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}

        {/* Textarea Container */}
        <div className="relative">
          {/* Textarea */}
          <textarea
            ref={ref}
            id={textareaId}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            className={textareaStyles}
            aria-invalid={hasError}
            aria-describedby={
              displayHelperText || showCounter ? `${textareaId}-helper` : undefined
            }
            {...props}
          />

          {/* 错误图标 */}
          {hasError && (
            <div className="pointer-events-none absolute right-3 top-3 text-red-500">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Footer: Helper Text + Counter */}
        {(displayHelperText || showCounter) && (
          <div
            id={`${textareaId}-helper`}
            className="mt-1.5 flex items-center justify-between gap-2"
          >
            {/* Helper/Error Text */}
            {displayHelperText && (
              <p
                className={[
                  'text-xs',
                  hasError ? 'text-red-600' : 'text-gray-500',
                ].join(' ')}
              >
                {displayHelperText}
              </p>
            )}

            {/* Character Counter */}
            {showCounter && (
              <p
                className={[
                  'text-xs',
                  currentLength > maxLength!
                    ? 'text-red-600'
                    : 'text-gray-500',
                ].join(' ')}
              >
                {currentLength} / {maxLength}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

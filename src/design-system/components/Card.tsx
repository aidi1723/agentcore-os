import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Card 变体
 */
type CardVariant = 'default' | 'bordered' | 'elevated' | 'flat';

/**
 * Card 内边距
 */
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 卡片变体
   * @default 'default'
   */
  variant?: CardVariant;

  /**
   * 卡片内边距
   * @default 'md'
   */
  padding?: CardPadding;

  /**
   * 是否可悬停
   */
  hoverable?: boolean;

  /**
   * 是否可点击
   */
  clickable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-gray-200',
  bordered: 'bg-white border-2 border-gray-300',
  elevated: 'bg-white shadow-md',
  flat: 'bg-gray-50',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Card 组件
 *
 * 设计系统的标准卡片组件
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>标题</CardHeader>
 *   <CardBody>内容</CardBody>
 *   <CardFooter>底部</CardFooter>
 * </Card>
 *
 * <Card variant="elevated" hoverable>
 *   悬停效果卡片
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      clickable = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const cardStyles = [
      // 基础样式
      'rounded-2xl',
      'transition-all duration-200',

      // 变体和内边距
      variantStyles[variant],
      paddingStyles[padding],

      // 悬停效果
      hoverable ? 'hover:shadow-lg hover:-translate-y-0.5' : '',

      // 可点击样式
      clickable ? 'cursor-pointer active:scale-[0.98]' : '',

      // 自定义类名
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={cardStyles} {...props}>
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

/**
 * CardHeader 组件
 */
export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * 标题
   */
  title?: ReactNode;

  /**
   * 副标题
   */
  subtitle?: ReactNode;

  /**
   * 右侧操作区
   */
  actions?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, actions, className = '', children, ...props }, ref) => {
    const hasContent = title || subtitle || actions || children;

    if (!hasContent) return null;

    return (
      <div
        ref={ref}
        className={[
          'flex items-start justify-between gap-4',
          className,
        ].join(' ')}
        {...props}
      >
        {(title || subtitle || children) && (
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-gray-500">
                {subtitle}
              </p>
            )}
            {children}
          </div>
        )}

        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    );
  },
);

CardHeader.displayName = 'CardHeader';

/**
 * CardBody 组件
 */
export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 内容间距
   */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const spacingStyles: Record<NonNullable<CardBodyProps['spacing']>, string> = {
  none: '',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
};

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ spacing = 'md', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[spacingStyles[spacing], className].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  },
);

CardBody.displayName = 'CardBody';

/**
 * CardFooter 组件
 */
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 对齐方式
   */
  align?: 'left' | 'center' | 'right' | 'between';
}

const alignStyles: Record<NonNullable<CardFooterProps['align']>, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
};

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ align = 'right', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          'flex items-center gap-2',
          alignStyles[align],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  },
);

CardFooter.displayName = 'CardFooter';

/**
 * CardDivider 组件 - 卡片分隔线
 */
export interface CardDividerProps extends HTMLAttributes<HTMLHRElement> {}

export const CardDivider = forwardRef<HTMLHRElement, CardDividerProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <hr
        ref={ref}
        className={['my-4 border-gray-200', className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  },
);

CardDivider.displayName = 'CardDivider';

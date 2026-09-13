# AgentCore OS 设计系统架构

**版本**: 1.0  
**创建日期**: 2026-09-12  
**维护者**: Claude Opus 5

---

## 📐 架构概览

```
agentcore-os/
├── src/
│   ├── design-system/           # 设计系统根目录
│   │   ├── tokens.ts            # 设计令牌（颜色、间距、圆角等）
│   │   ├── components/          # 组件库
│   │   │   ├── Button.tsx       # 按钮组件
│   │   │   ├── Input.tsx        # 输入框组件
│   │   │   ├── Textarea.tsx     # 文本域组件
│   │   │   ├── Card.tsx         # 卡片组件
│   │   │   └── Badge.tsx        # 徽章组件
│   │   └── index.ts             # 统一导出
│   │
│   └── components/
│       └── apps/                # 应用窗口（使用设计系统）
│           ├── DealDeskAppWindow.tsx
│           ├── EmailAssistantAppWindow.tsx
│           └── ...              # 其他 30 个应用
│
└── docs/
    ├── analysis/                # 分析文档
    │   └── 2026-09-12-deal-desk-refactor-comparison.md
    ├── guides/                  # 使用指南
    │   └── design-system-migration-guide.md
    ├── plans/                   # 计划文档
    │   └── 2026-09-12-app-windows-batch-optimization.md
    └── reports/                 # 进度报告
        └── 2026-09-12-design-system-progress-report.md
```

---

## 🎨 设计系统层次

### 第一层：设计令牌（Tokens）

设计令牌是设计系统的基础，定义了所有基础设计决策。

```tsx
// src/design-system/tokens.ts

export const designTokens = {
  colors: {
    // 6 种语义化变体
    variants: {
      default: { ... },
      primary: { ... },
      success: { ... },
      warning: { ... },
      danger: { ... },
      info: { ... },
    }
  },
  spacing: {
    // 基于 8px 的间距系统
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    // ...
  },
  borderRadius: {
    // 统一的圆角系统
    xl: '0.75rem',   // 12px
    '2xl': '1rem',   // 16px
    full: '9999px',  // 完全圆角
  },
  shadows: {
    // 3 级阴影系统
    sm: '...',
    md: '...',
    lg: '...',
  }
}
```

**作用**：
- 集中管理所有设计决策
- 修改令牌，全局生效
- 避免硬编码值

---

### 第二层：基础组件（Components）

基础组件使用设计令牌构建，提供可复用的 UI 元素。

#### 组件设计原则

1. **单一职责**：每个组件只做一件事
2. **组合优于继承**：通过组合构建复杂 UI
3. **可访问性优先**：所有组件内置 ARIA 支持
4. **类型安全**：完整的 TypeScript 类型定义
5. **一致性**：统一的 API 设计风格

#### 组件列表

| 组件 | 职责 | 状态 |
|------|------|------|
| Button | 操作按钮 | ✅ 完成 |
| Input | 单行输入 | ✅ 完成 |
| Textarea | 多行输入 | ✅ 完成 |
| Card | 内容容器 | ✅ 完成 |
| Badge | 状态标签 | ✅ 完成 |
| Select | 下拉选择 | 📋 待开发 |
| Checkbox | 复选框 | 📋 待开发 |
| Radio | 单选框 | 📋 待开发 |
| Switch | 开关 | 📋 待开发 |
| Modal | 弹窗 | 📋 待开发 |
| Toast | 提示 | 📋 待开发 |
| Dropdown | 下拉菜单 | 📋 待开发 |
| Tabs | 标签页 | 📋 待开发 |
| Accordion | 手风琴 | 📋 待开发 |
| Tooltip | 工具提示 | 📋 待开发 |

---

### 第三层：业务组件（Applications）

业务组件使用基础组件和设计令牌构建具体功能。

```tsx
// src/components/apps/DealDeskAppWindow.tsx

import { Button, Input, Card, Badge } from "@/design-system";

export function DealDeskAppWindow() {
  return (
    <Card padding="md">
      <CardHeader 
        title="线索信息"
        actions={<Button variant="primary">保存</Button>}
      />
      <CardBody>
        <Input label="公司" fullWidth />
        <Badge variant="success">已完成</Badge>
      </CardBody>
    </Card>
  );
}
```

---

## 🔄 数据流

```
设计令牌 (tokens.ts)
    ↓
基础组件 (Button, Input, Card, ...)
    ↓
业务组件 (DealDeskAppWindow, EmailAssistantAppWindow, ...)
    ↓
用户界面
```

---

## 📦 导入导出策略

### 集中导出

```tsx
// src/design-system/index.ts
export * from './tokens';
export * from './components/Button';
export * from './components/Input';
export * from './components/Textarea';
export * from './components/Card';
export * from './components/Badge';
```

### 推荐导入方式

```tsx
// ✅ 推荐：命名导入
import { Button, Input, Card } from "@/design-system";

// ✅ 也可以：分别导入
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";

// ❌ 避免：默认导入
import Button from "@/design-system/components/Button";  // 不支持
```

---

## 🎯 组件 API 设计规范

### 1. Props 命名规范

```tsx
interface ComponentProps {
  // 变体：使用 variant
  variant?: 'primary' | 'secondary' | 'success' | ...;
  
  // 尺寸：使用 size
  size?: 'sm' | 'md' | 'lg';
  
  // 状态：使用 state
  state?: 'default' | 'error' | 'success';
  
  // 禁用：使用 disabled
  disabled?: boolean;
  
  // 加载：使用 loading
  loading?: boolean;
  
  // 全宽：使用 fullWidth
  fullWidth?: boolean;
  
  // 子元素：使用 children
  children?: ReactNode;
  
  // 类名：使用 className
  className?: string;
}
```

### 2. 默认值规范

```tsx
// ✅ 推荐：在参数解构中设置默认值
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  ...props
}) {
  // ...
}

// ❌ 避免：使用 defaultProps
Button.defaultProps = {
  variant: 'primary',
  // ...
};
```

### 3. 转发 Ref

```tsx
// ✅ 所有组件都应该支持 ref 转发
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <button ref={ref} {...props} />;
  }
);

Button.displayName = 'Button';
```

---

## 🎨 样式组织规范

### 1. 使用 Tailwind CSS

所有样式使用 Tailwind CSS 类名，不使用内联样式或 CSS-in-JS。

```tsx
// ✅ 推荐
<button className="rounded-xl bg-blue-500 px-4 py-2 text-white">

// ❌ 避免
<button style={{ borderRadius: '12px', background: 'blue' }}>
```

### 2. 样式组合模式

```tsx
// ✅ 推荐：数组拼接，便于条件样式
const buttonStyles = [
  // 基础样式
  'inline-flex items-center gap-2',
  'rounded-xl px-4 py-2',
  'font-semibold transition-colors',
  
  // 条件样式
  variant === 'primary' && 'bg-blue-500 text-white',
  disabled && 'opacity-50 cursor-not-allowed',
  
  // 自定义类名
  className,
]
  .filter(Boolean)
  .join(' ');

return <button className={buttonStyles} />;
```

### 3. 避免硬编码

```tsx
// ❌ 避免：硬编码颜色值
<button className="bg-blue-500 hover:bg-blue-600">

// ✅ 推荐：使用设计令牌或变体
<Button variant="primary">
```

---

## ♿ 可访问性规范

### 1. 语义化 HTML

```tsx
// ✅ 使用正确的 HTML 元素
<button type="button">点击</button>
<label htmlFor="input-id">标签</label>
<input id="input-id" />

// ❌ 避免使用 div 模拟
<div onClick={...}>点击</div>
```

### 2. ARIA 属性

```tsx
// ✅ 添加必要的 ARIA 属性
<button
  aria-label="关闭对话框"
  aria-disabled={disabled}
  aria-busy={loading}
>

<input
  aria-invalid={hasError}
  aria-describedby="error-message"
/>
```

### 3. 键盘导航

```tsx
// ✅ 支持键盘操作
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
```

### 4. 焦点管理

```tsx
// ✅ 提供清晰的焦点指示
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500">
```

---

## 🧪 测试策略

### 1. 单元测试

每个组件都应该有单元测试：

```tsx
// Button.test.tsx
describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('supports disabled state', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

### 2. 可访问性测试

使用 jest-axe 进行可访问性测试：

```tsx
import { axe } from 'jest-axe';

it('should not have accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 3. 视觉回归测试

使用 Storybook + Chromatic 进行视觉回归测试。

---

## 📚 文档规范

### 1. 组件文档结构

每个组件都应该有清晰的文档：

```tsx
/**
 * Button 组件
 *
 * 设计系统的标准按钮组件，支持多种变体和状态。
 *
 * @example
 * ```tsx
 * // 基础用法
 * <Button variant="primary" onClick={handleClick}>
 *   点击我
 * </Button>
 *
 * // 带图标
 * <Button icon={<Plus />} variant="success">
 *   新建
 * </Button>
 *
 * // 加载状态
 * <Button loading={isLoading}>
 *   提交
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
```

### 2. Props 文档

使用 JSDoc 注释每个 prop：

```tsx
export interface ButtonProps {
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
   * 是否禁用
   */
  disabled?: boolean;
}
```

---

## 🔧 开发工作流

### 1. 新增组件流程

1. **设计阶段**
   - 确定组件职责
   - 设计 API 接口
   - 评审设计方案

2. **开发阶段**
   - 创建组件文件
   - 实现功能逻辑
   - 添加类型定义
   - 编写文档注释

3. **测试阶段**
   - 编写单元测试
   - 可访问性测试
   - 视觉回归测试

4. **集成阶段**
   - 导出组件
   - 更新文档
   - Code Review

### 2. 修改组件流程

1. **评估影响**
   - 检查使用情况
   - 确认破坏性变更

2. **实施修改**
   - 更新组件代码
   - 更新测试用例
   - 更新文档

3. **迁移指导**
   - 提供迁移指南
   - 更新示例代码

---

## 🚀 性能优化

### 1. 代码分割

```tsx
// 懒加载大型组件
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Spinner />}>
  <HeavyComponent />
</Suspense>
```

### 2. 避免重渲染

```tsx
// 使用 memo 优化
export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    // ...
  })
);

// 使用 useCallback
const handleClick = useCallback(() => {
  // ...
}, [dependencies]);
```

### 3. 打包优化

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // 生产环境移除未使用的样式
}
```

---

## 📊 度量指标

### 代码质量指标

- **TypeScript 覆盖率**: 目标 100%
- **测试覆盖率**: 目标 ≥ 80%
- **可访问性合规**: 目标 100% WCAG 2.1 AA

### 性能指标

- **组件渲染时间**: 目标 < 16ms
- **打包体积**: 目标每个组件 < 10KB (gzip)
- **首次加载时间**: 目标 < 3s

### 使用指标

- **组件使用率**: 追踪每个组件的使用次数
- **硬编码样式**: 目标减少 > 80%
- **代码复用率**: 目标 > 90%

---

## 🔄 版本管理

### 语义化版本

```
主版本号.次版本号.修订号

1.0.0 - 初始版本
1.1.0 - 新增功能（向后兼容）
1.1.1 - Bug 修复（向后兼容）
2.0.0 - 破坏性变更
```

### 变更日志

每次发布都应该更新 CHANGELOG.md：

```markdown
## [1.1.0] - 2026-09-12

### Added
- 新增 Select 组件
- Button 组件支持 iconRight 属性

### Changed
- 优化 Input 组件的焦点样式

### Fixed
- 修复 Card 组件在移动端的显示问题
```

---

## 📞 支持与反馈

### 问题反馈

1. **Bug 报告**: 提供复现步骤和环境信息
2. **功能请求**: 说明使用场景和期望行为
3. **改进建议**: 附上具体的改进方案

### 文档位置

- **架构文档**: `docs/architecture/design-system-architecture.md`
- **迁移指南**: `docs/guides/design-system-migration-guide.md`
- **API 文档**: 每个组件的 JSDoc 注释
- **示例代码**: Storybook 或组件文件中的 @example

---

**维护者**: Claude Opus 5  
**创建日期**: 2026-09-12  
**最后更新**: 2026-09-12  
**版本**: 1.0

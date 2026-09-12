# AgentCore OS 设计系统

这是 AgentCore OS 的设计系统组件库，基于"可控 Runtime"的品牌定位设计。

## 📦 设计 Tokens

设计 tokens 定义在 `src/styles/design-tokens/` 目录下：

- **colors.css** - 品牌色、状态色、背景色等
- **spacing.css** - 间距系统（基于 8px 网格）
- **typography.css** - 字体系统（流式响应式）
- **border-radius.css** - 圆角系统

## 🎨 核心组件

### Button（按钮）

```tsx
import { Button } from '@/components/design-system';

// 5 种变体
<Button variant="primary">主要按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button variant="tertiary">第三级按钮</Button>
<Button variant="ghost">幽灵按钮</Button>
<Button variant="danger">危险按钮</Button>

// 3 种尺寸
<Button size="sm">小按钮</Button>
<Button size="md">中等按钮</Button>
<Button size="lg">大按钮</Button>

// 加载状态
<Button loading>加载中...</Button>

// 带图标
<Button icon={<Icon />}>带图标</Button>
```

### Card（卡片）

```tsx
import { Card, CardHeader, CardContent, CardFooter } from '@/components/design-system';

<Card variant="elevated" interactive>
  <CardHeader>卡片标题</CardHeader>
  <CardContent>卡片内容</CardContent>
  <CardFooter>卡片底部</CardFooter>
</Card>
```

### Badge（徽章）

```tsx
import { Badge } from '@/components/design-system';

// 状态徽章
<Badge variant="success">成功</Badge>
<Badge variant="warning">等待审批</Badge>
<Badge variant="error">失败</Badge>
<Badge variant="info">运行中</Badge>

// 圆点指示器
<Badge variant="success" dot />
```

## 🎬 动画系统

动画系统定义在 `src/styles/animations.css`：

```tsx
// 使用工具类
<div className="animate-fade-in">淡入</div>
<div className="animate-slide-in-up">滑入</div>
<div className="animate-pulse">脉动</div>
<div className="animate-shimmer">骨架屏</div>

// 使用 CSS 变量
.custom-element {
  transition: all var(--duration-micro) var(--ease-out);
}
```

## 🎯 使用指南

### 1. 在项目中引入

在 `src/app/layout.tsx` 中引入全局样式：

```tsx
import '@/styles/globals.css';
```

### 2. 使用组件

```tsx
import { Button, Card, Badge } from '@/components/design-system';

export default function MyComponent() {
  return (
    <Card>
      <Badge variant="success">Active</Badge>
      <Button variant="primary">点击我</Button>
    </Card>
  );
}
```

### 3. 使用设计 tokens

在 CSS 模块中直接使用 CSS 变量：

```css
.custom-component {
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: var(--spacing-4);
  border-radius: var(--radius-card);
  transition: all var(--duration-micro) var(--ease-out);
}
```

## 🎨 品牌视觉

### 核心视觉隐喻："受控管道流"

将"可控 Playbook Runtime"可视化为一个有序的、可监控的、可干预的管道系统。

### 配色方案

- **主色**: 赛博蓝 `#0EA5E9` - 代表"可控"和"科技"
- **状态色**:
  - 运行中: 蓝色 `#3B82F6`
  - 等待审批: 琥珀色 `#F59E0B`
  - 成功: 翠绿色 `#10B981`
  - 失败: 红色 `#EF4444`
  - 待执行: 灰色 `#6B7280`

### 背景色

深空科技感：
- 基础层: `#0A0E1A` (深空蓝黑)
- 提升层: `#111827`
- 表面层: `#1F2937`
- 交互层: `#374151`

## 📝 开发计划

### 已完成 ✅
- [x] 设计 tokens 系统
- [x] 动画系统
- [x] Button 组件
- [x] Card 组件
- [x] Badge 组件

### 进行中 🚧
- [ ] StatusBadge 组件（Playbook 状态）
- [ ] Input 组件
- [ ] Select 组件
- [ ] Modal 组件
- [ ] Toast 通知系统

### 计划中 📋
- [ ] Dropdown 组件
- [ ] Tabs 组件
- [ ] Avatar 组件
- [ ] Skeleton 骨架屏
- [ ] ProgressBar 进度条
- [ ] Timeline 时间线
- [ ] EmptyState 空状态

## 🔗 相关文档

- [UI/UX 改进方案](../../docs/UI_UX_IMPROVEMENT_PROPOSAL.zh-CN.md)
- [UI/UX 改进摘要](../../docs/UI_UX_IMPROVEMENT_SUMMARY.zh-CN.md)

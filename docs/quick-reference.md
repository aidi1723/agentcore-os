# 设计系统快速参考

**版本**: 1.0  
**日期**: 2026-09-12

---

## 📦 快速导入

```tsx
import { Button, Input, Textarea, Card, Badge } from "@/design-system";
import { CardHeader, CardBody, CardDivider, CardFooter } from "@/design-system";
```

---

## 🔘 Button 组件

### 基础用法

```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  点击我
</Button>
```

### 变体（variant）

| 值 | 用途 | 示例 |
|---|------|------|
| `primary` | 主要操作 | 提交、确认、保存 |
| `secondary` | 次要操作 | 取消、关闭 |
| `success` | 成功操作 | 生成、创建 |
| `warning` | 警告操作 | 重置、清空 |
| `danger` | 危险操作 | 删除、移除 |
| `ghost` | 辅助操作 | 设置、更多 |

### 尺寸（size）

| 值 | 高度 | 用途 |
|---|------|------|
| `sm` | 32px | 列表项、工具栏 |
| `md` | 40px | 表单、卡片 |
| `lg` | 48px | 页面主要操作 |

### 特殊状态

```tsx
// 带图标
<Button icon={<Plus />}>新建</Button>
<Button iconRight={<ArrowRight />}>下一步</Button>

// 加载状态
<Button loading={isLoading}>提交</Button>

// 禁用状态
<Button disabled>不可用</Button>

// 全宽
<Button fullWidth>占满整行</Button>
```

---

## 📝 Input 组件

### 基础用法

```tsx
<Input
  label="用户名"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  fullWidth
/>
```

### 状态（state）

| 值 | 颜色 | 用途 |
|---|------|------|
| `default` | 蓝色 | 正常状态 |
| `error` | 红色 | 错误提示 |
| `success` | 绿色 | 验证通过 |

### 高级功能

```tsx
// 必填
<Input label="邮箱" required />

// 错误提示
<Input state="error" errorText="邮箱格式不正确" />

// 帮助文本
<Input helperText="请输入 8-20 个字符" />

// 带图标
<Input iconLeft={<Search />} />
<Input iconRight={<Eye />} />
```

---

## 📄 Textarea 组件

### 基础用法

```tsx
<Textarea
  label="描述"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={4}
  fullWidth
/>
```

### 高级功能

```tsx
// 字符计数
<Textarea maxLength={200} showCount />

// 调整大小
<Textarea resize="vertical" />  // vertical, horizontal, both, none

// 错误状态
<Textarea state="error" errorText="内容不能为空" />
```

---

## 🃏 Card 组件

### 基础用法

```tsx
<Card padding="md">
  <CardHeader 
    title="标题"
    subtitle="副标题"
    actions={<Button size="sm">操作</Button>}
  />
  <CardDivider />
  <CardBody spacing="md">
    内容区域
  </CardBody>
</Card>
```

### 内边距（padding）

| 值 | 内边距 | 用途 |
|---|--------|------|
| `sm` | 12px | 紧凑卡片 |
| `md` | 20px | 标准卡片 |
| `lg` | 24px | 宽松卡片 |

### CardBody 间距（spacing）

| 值 | 间距 | 用途 |
|---|------|------|
| `sm` | 8px | 紧凑内容 |
| `md` | 16px | 标准内容 |
| `lg` | 24px | 宽松内容 |

### 特殊变体

```tsx
// 可悬停
<Card hoverable>...</Card>

// 可点击
<Card clickable onClick={handleClick}>...</Card>
```

---

## 🏷️ Badge 组件

### 基础用法

```tsx
<Badge variant="primary">标签</Badge>
```

### 变体（variant）

| 值 | 颜色 | 用途 |
|---|------|------|
| `default` | 灰色 | 默认标签 |
| `primary` | 蓝色 | 进行中、活跃 |
| `success` | 绿色 | 已完成、成功 |
| `warning` | 黄色 | 待处理、警告 |
| `danger` | 红色 | 错误、阻塞 |
| `info` | 天蓝 | 信息、提示 |

### 尺寸（size）

| 值 | 高度 | 用途 |
|---|------|------|
| `sm` | 20px | 表格、列表 |
| `md` | 24px | 卡片、表单 |
| `lg` | 28px | 页面标题 |

### 特殊功能

```tsx
// 带圆点
<Badge variant="success" dot>已完成</Badge>
```

---

## 🎨 设计令牌

### 颜色系统

```
default:  灰色   bg-gray-100    text-gray-700
primary:  蓝色   bg-blue-500    text-white
success:  绿色   bg-emerald-600 text-white
warning:  黄色   bg-amber-500   text-white
danger:   红色   bg-red-600     text-white
info:     天蓝   bg-sky-500     text-white
```

### 间距系统（基于 8px）

```
小元素:  gap-2      8px
中等:    gap-4      16px
表单组:  space-y-4  16px
内容节:  space-y-6  24px
大节:    space-y-8  32px
```

### 圆角系统

```
小元素:  rounded-xl    12px  (按钮、输入框、徽章)
卡片:    rounded-2xl   16px  (卡片、文本域)
圆形:    rounded-full  50%   (头像、圆点)
```

---

## 📐 常用布局模式

### 1. 表单布局

```tsx
<Card padding="md">
  <CardHeader title="表单标题" />
  <CardDivider />
  <CardBody spacing="md">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input label="字段1" fullWidth />
      <Input label="字段2" fullWidth />
      <div className="md:col-span-2">
        <Textarea label="字段3" rows={4} fullWidth />
      </div>
    </div>
  </CardBody>
</Card>
```

### 2. 列表+详情

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
  {/* 侧边栏 */}
  <aside>
    <Card padding="md">
      <CardHeader title="列表" actions={<Button size="sm">新建</Button>} />
      <CardDivider />
      <CardBody spacing="sm">
        {/* 列表项 */}
      </CardBody>
    </Card>
  </aside>
  
  {/* 主内容 */}
  <main>
    <Card padding="md">
      <CardHeader title="详情" />
      <CardDivider />
      <CardBody spacing="md">
        {/* 详情内容 */}
      </CardBody>
    </Card>
  </main>
</div>
```

### 3. 操作栏

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button variant="primary">主要操作</Button>
  <Button variant="secondary">次要操作</Button>
  <Button variant="ghost">辅助操作</Button>
  <div className="ml-auto">
    <Badge variant="info">{count} 项</Badge>
  </div>
</div>
```

### 4. 列表项（可选中）

```tsx
<button
  className={[
    "w-full rounded-xl border p-3 text-left transition-all duration-200",
    isActive
      ? "border-blue-500 bg-blue-50 shadow-sm"
      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
  ].join(" ")}
>
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-gray-900">
        标题
      </div>
      <div className="mt-1 text-xs text-gray-500">
        描述
      </div>
    </div>
    <Badge variant="primary" size="sm">状态</Badge>
  </div>
</button>
```

---

## ✅ 迁移检查清单

### 准备
- [ ] 导入设计系统组件
- [ ] 备份原始文件

### 替换（按优先级）
- [ ] 替换所有 Button
- [ ] 替换所有 Input
- [ ] 替换所有 Textarea
- [ ] 替换所有 Card 结构
- [ ] 替换所有 Badge

### 优化
- [ ] 统一间距（space-y-4/6，gap-4/6）
- [ ] 统一圆角（rounded-xl/2xl）
- [ ] 简化嵌套（目标 ≤ 5 层）
- [ ] 优化响应式（统一 lg 断点）

### 测试
- [ ] 视觉检查（所有状态）
- [ ] 功能测试（所有交互）
- [ ] 响应式测试（mobile/tablet/desktop）
- [ ] 可访问性测试（键盘导航）

---

## 🚫 常见错误

### ❌ 避免

```tsx
// 硬编码颜色
<button className="bg-blue-500">

// 混乱的间距
<div className="gap-2 space-y-3 mt-4">

// 过度嵌套
<div><div><div><div><div><div><div>

// 忽略可访问性
<button disabled>按钮</button>  // 没有 aria-label
```

### ✅ 推荐

```tsx
// 使用语义化变体
<Button variant="primary">

// 统一的间距
<div className="space-y-4">

// 使用组件
<Card><CardBody>

// 完整的可访问性
<Button disabled aria-label="此操作当前不可用">
```

---

## 📞 快速链接

- **架构文档**: `docs/architecture/design-system-architecture.md`
- **迁移指南**: `docs/guides/design-system-migration-guide.md`
- **对比示例**: `docs/analysis/2026-09-12-deal-desk-refactor-comparison.md`
- **批量计划**: `docs/plans/2026-09-12-app-windows-batch-optimization.md`
- **进度报告**: `docs/reports/2026-09-12-design-system-progress-report.md`

---

## 💡 小贴士

1. **先看示例** - DealDeskAppWindow.v2.tsx 和 EmailAssistantAppWindow.v2.tsx
2. **按优先级** - 先替换 Button，影响最大
3. **测试频繁** - 每完成一部分就测试
4. **保持一致** - 遵循已有模式
5. **遇到问题** - 查看迁移指南的故障排查章节

---

**创建**: 2026-09-12  
**维护**: Claude Opus 5  
**版本**: 1.0

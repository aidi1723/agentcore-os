# 设计系统迁移指南

**版本**: 1.0  
**日期**: 2026-09-12  
**适用范围**: 所有应用窗口组件

---

## 📚 目录

1. [快速开始](#快速开始)
2. [组件替换对照表](#组件替换对照表)
3. [迁移检查清单](#迁移检查清单)
4. [常见模式](#常见模式)
5. [故障排查](#故障排查)

---

## 🚀 快速开始

### 第一步：导入设计系统组件

```tsx
// 在组件顶部添加
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody, CardDivider } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
```

### 第二步：逐个替换原生元素

不要一次性全部替换！按照以下优先级：

1. **按钮** - 影响最大，最容易替换
2. **输入框** - 提升表单一致性
3. **卡片** - 改善布局结构
4. **徽章** - 统一状态显示
5. **其他元素** - 逐步优化

### 第三步：测试和调整

- 检查视觉效果
- 测试交互功能
- 验证响应式布局
- 检查可访问性

---

## 🔄 组件替换对照表

### 1. Button（按钮）

#### 主要操作按钮
```tsx
// ❌ 旧代码
<button
  type="button"
  onClick={handleClick}
  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
  disabled={isDisabled}
>
  确认
</button>

// ✅ 新代码
<Button
  variant="primary"
  size="md"
  onClick={handleClick}
  disabled={isDisabled}
>
  确认
</Button>
```

#### 次要操作按钮
```tsx
// ❌ 旧代码
<button className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100">
  取消
</button>

// ✅ 新代码
<Button variant="secondary" size="sm">
  取消
</Button>
```

#### 危险操作按钮
```tsx
// ❌ 旧代码
<button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100">
  <Trash2 className="h-4 w-4" />
  删除
</button>

// ✅ 新代码
<Button
  variant="danger"
  size="sm"
  icon={<Trash2 className="h-4 w-4" />}
>
  删除
</Button>
```

#### 成功按钮
```tsx
// ❌ 旧代码
<button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700">
  <Sparkles className="h-4 w-4" />
  生成
</button>

// ✅ 新代码
<Button
  variant="success"
  size="sm"
  icon={<Sparkles className="h-4 w-4" />}
>
  生成
</Button>
```

#### 加载状态按钮
```tsx
// ❌ 旧代码
<button disabled={isLoading}>
  {isLoading ? "加载中..." : "提交"}
</button>

// ✅ 新代码
<Button loading={isLoading}>
  提交
</Button>
```

#### 全宽按钮
```tsx
// ❌ 旧代码
<button className="w-full ...">按钮</button>

// ✅ 新代码
<Button fullWidth>按钮</Button>
```

#### 图标按钮
```tsx
// ❌ 旧代码
<button>
  <Plus className="h-4 w-4" />
  <span>新建</span>
</button>

// ✅ 新代码
<Button icon={<Plus className="h-4 w-4" />}>
  新建
</Button>

// 或者右侧图标
<Button iconRight={<ArrowRight className="h-4 w-4" />}>
  下一步
</Button>
```

---

### 2. Input（输入框）

#### 基础输入框
```tsx
// ❌ 旧代码
<div>
  <label className="mb-2 block text-xs font-semibold text-gray-600">用户名</label>
  <input
    value={username}
    onChange={(e) => setUsername(e.target.value)}
    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

// ✅ 新代码
<Input
  label="用户名"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  fullWidth
/>
```

#### 必填输入框
```tsx
// ❌ 旧代码
<label>
  公司 <span className="text-red-500">*</span>
</label>

// ✅ 新代码
<Input
  label="公司"
  required
  fullWidth
/>
```

#### 带错误提示的输入框
```tsx
// ❌ 旧代码
<div>
  <input className="border-red-300 ..." />
  <p className="mt-1 text-xs text-red-600">邮箱格式不正确</p>
</div>

// ✅ 新代码
<Input
  label="邮箱"
  type="email"
  state="error"
  errorText="邮箱格式不正确"
  fullWidth
/>
```

#### 带帮助文本的输入框
```tsx
// ❌ 旧代码
<div>
  <input ... />
  <p className="mt-1 text-xs text-gray-500">请输入 8-20 个字符</p>
</div>

// ✅ 新代码
<Input
  label="密码"
  type="password"
  helperText="请输入 8-20 个字符"
  fullWidth
/>
```

#### 带图标的输入框
```tsx
// ❌ 旧代码
<div className="relative">
  <div className="absolute left-3 ...">
    <Search className="h-4 w-4" />
  </div>
  <input className="pl-10 ..." />
</div>

// ✅ 新代码
<Input
  iconLeft={<Search className="h-4 w-4" />}
  placeholder="搜索..."
  fullWidth
/>
```

---

### 3. Textarea（文本域）

#### 基础文本域
```tsx
// ❌ 旧代码
<div>
  <label className="mb-2 block text-xs font-semibold text-gray-600">描述</label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm resize-vertical"
    rows={4}
  />
</div>

// ✅ 新代码
<Textarea
  label="描述"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={4}
  fullWidth
/>
```

#### 带字符计数的文本域
```tsx
// ❌ 旧代码
<div>
  <textarea maxLength={200} ... />
  <p className="text-xs text-gray-500">{text.length} / 200</p>
</div>

// ✅ 新代码
<Textarea
  label="简介"
  value={text}
  onChange={(e) => setText(e.target.value)}
  maxLength={200}
  showCount
  fullWidth
/>
```

#### 不可调整大小的文本域
```tsx
// ❌ 旧代码
<textarea className="resize-none ..." />

// ✅ 新代码
<Textarea resize="none" fullWidth />
```

---

### 4. Card（卡片）

#### 基础卡片
```tsx
// ❌ 旧代码
<div className="rounded-2xl border border-gray-200 bg-white p-5">
  <div className="text-sm font-semibold text-gray-900">标题</div>
  <div className="mt-4">内容</div>
</div>

// ✅ 新代码
<Card padding="md">
  <div className="text-sm font-semibold text-gray-900">标题</div>
  <div className="mt-4">内容</div>
</Card>
```

#### 带头部和内容的卡片
```tsx
// ❌ 旧代码
<div className="rounded-2xl border border-gray-200 bg-white p-5">
  <div className="flex items-start justify-between border-b border-gray-200 pb-4">
    <div>
      <div className="text-sm font-semibold text-gray-900">标题</div>
      <div className="mt-1 text-xs text-gray-500">副标题</div>
    </div>
    <button>操作</button>
  </div>
  <div className="mt-4">内容</div>
</div>

// ✅ 新代码
<Card padding="md">
  <CardHeader
    title="标题"
    subtitle="副标题"
    actions={<Button size="sm">操作</Button>}
  />
  <CardDivider />
  <CardBody spacing="md">
    内容
  </CardBody>
</Card>
```

#### 可悬停的卡片
```tsx
// ❌ 旧代码
<div className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
  内容
</div>

// ✅ 新代码
<Card padding="md" hoverable>
  内容
</Card>
```

#### 可点击的卡片
```tsx
// ❌ 旧代码
<div
  onClick={handleClick}
  className="rounded-2xl border border-gray-200 bg-white p-5 cursor-pointer active:scale-[0.98]"
>
  内容
</div>

// ✅ 新代码
<Card padding="md" clickable onClick={handleClick}>
  内容
</Card>
```

---

### 5. Badge（徽章）

#### 基础徽章
```tsx
// ❌ 旧代码
<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
  默认
</span>

// ✅ 新代码
<Badge variant="default">默认</Badge>
```

#### 状态徽章
```tsx
// ❌ 旧代码
<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
  已完成
</span>

// ✅ 新代码
<Badge variant="success">已完成</Badge>
```

#### 带圆点的徽章
```tsx
// ❌ 旧代码
<span className="inline-flex items-center gap-1.5 ...">
  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
  进行中
</span>

// ✅ 新代码
<Badge variant="primary" dot>进行中</Badge>
```

#### 不同尺寸的徽章
```tsx
// ✅ 小号
<Badge size="sm">小</Badge>

// ✅ 中号（默认）
<Badge size="md">中</Badge>

// ✅ 大号
<Badge size="lg">大</Badge>
```

---

## ✅ 迁移检查清单

### 准备阶段
- [ ] 阅读设计系统文档
- [ ] 了解组件 API
- [ ] 备份原始文件
- [ ] 创建新分支

### 替换阶段
- [ ] 导入设计系统组件
- [ ] 替换所有 Button
- [ ] 替换所有 Input
- [ ] 替换所有 Textarea
- [ ] 替换所有 Card 结构
- [ ] 替换所有 Badge
- [ ] 删除不再使用的样式类

### 优化阶段
- [ ] 统一间距（使用 space-y-4/6，gap-4/6）
- [ ] 统一圆角（rounded-xl/2xl）
- [ ] 检查颜色语义化
- [ ] 优化响应式布局
- [ ] 简化组件嵌套

### 测试阶段
- [ ] 视觉检查（所有状态）
- [ ] 功能测试（所有交互）
- [ ] 响应式测试（mobile/tablet/desktop）
- [ ] 可访问性测试（键盘导航）
- [ ] 浏览器兼容性测试

### 文档阶段
- [ ] 更新组件注释
- [ ] 记录特殊处理
- [ ] 提交 PR
- [ ] Code Review

---

## 🎨 常见模式

### 模式 1: 表单布局

```tsx
<Card padding="md">
  <CardHeader title="表单标题" subtitle="表单说明" />
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
  <CardDivider />
  <CardFooter align="right">
    <Button variant="secondary">取消</Button>
    <Button variant="primary">提交</Button>
  </CardFooter>
</Card>
```

### 模式 2: 列表 + 详情

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
  {/* 侧边栏 - 列表 */}
  <aside>
    <Card padding="md">
      <CardHeader
        title="列表"
        actions={<Button size="sm" icon={<Plus />}>新建</Button>}
      />
      <CardDivider />
      <CardBody spacing="sm">
        {items.map((item) => (
          <button
            key={item.id}
            className={[
              "w-full rounded-xl border p-3 text-left transition-all",
              selected === item.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:bg-gray-50",
            ].join(" ")}
          >
            {item.name}
          </button>
        ))}
      </CardBody>
    </Card>
  </aside>

  {/* 主内容 - 详情 */}
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

### 模式 3: 操作栏

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button variant="primary" icon={<Sparkles />}>主要操作</Button>
  <Button variant="secondary">次要操作</Button>
  <Button variant="ghost" icon={<Settings />}>设置</Button>
  <div className="ml-auto">
    <Badge variant="info">{count} 项</Badge>
  </div>
</div>
```

### 模式 4: 状态面板

```tsx
<Card padding="md">
  <div className="grid gap-4 md:grid-cols-3">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
        进行中
      </div>
      <div className="mt-2 text-2xl font-bold text-blue-900">{activeCount}</div>
    </div>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
        已完成
      </div>
      <div className="mt-2 text-2xl font-bold text-emerald-900">{doneCount}</div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        待处理
      </div>
      <div className="mt-2 text-2xl font-bold text-amber-900">{pendingCount}</div>
    </div>
  </div>
</Card>
```

---

## 🔧 故障排查

### 问题 1: 样式不生效

**症状**: 组件显示不正常

**原因**: Tailwind 未扫描设计系统目录

**解决**:
```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/design-system/**/*.{js,ts,jsx,tsx}', // 添加这行
  ],
}
```

### 问题 2: TypeScript 报错

**症状**: 导入组件时类型错误

**原因**: 类型定义不完整

**解决**:
```tsx
// 确保使用正确的导入路径
import { Button } from "@/design-system/components/Button";

// 而不是
import { Button } from "@/design-system"; // 可能导致类型丢失
```

### 问题 3: 按钮点击无响应

**症状**: onClick 不触发

**原因**: 可能传入了 type="submit" 但没有 form

**解决**:
```tsx
// 确保 type="button"（Button 组件默认值）
<Button onClick={handleClick}>点击</Button>

// 或者在 form 中使用
<form onSubmit={handleSubmit}>
  <Button type="submit">提交</Button>
</form>
```

### 问题 4: 输入框值不更新

**症状**: 输入框无法输入

**原因**: 使用了 value 但没有 onChange

**解决**:
```tsx
// ❌ 错误
<Input value={text} />

// ✅ 正确
<Input
  value={text}
  onChange={(e) => setText(e.target.value)}
/>
```

### 问题 5: 卡片内容溢出

**症状**: 内容超出卡片范围

**原因**: 缺少滚动容器或 min-w-0

**解决**:
```tsx
<Card padding="md">
  <CardBody>
    <div className="min-w-0 overflow-auto">
      {/* 长内容 */}
    </div>
  </CardBody>
</Card>
```

---

## 📊 性能优化建议

### 1. 避免内联函数

```tsx
// ❌ 避免
<Button onClick={() => handleClick(item.id)}>点击</Button>

// ✅ 推荐
const handleItemClick = useCallback(() => {
  handleClick(item.id);
}, [item.id]);

<Button onClick={handleItemClick}>点击</Button>
```

### 2. 使用 memo 优化重渲染

```tsx
// 对于不常变化的卡片列表
const MemoizedCard = memo(({ item }) => (
  <Card>
    <CardBody>{item.name}</CardBody>
  </Card>
));
```

### 3. 懒加载大型组件

```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loader />}>
  <HeavyComponent />
</Suspense>
```

---

## 🎯 最佳实践

### DO ✅

1. **使用语义化变体**
   ```tsx
   <Button variant="primary">确认</Button>
   <Button variant="danger">删除</Button>
   ```

2. **保持一致的间距**
   ```tsx
   <div className="space-y-6">  {/* 大节 */}
     <Card padding="md">
       <CardBody spacing="md">  {/* 中等间距 */}
         <div className="space-y-4">  {/* 小节 */}
   ```

3. **使用 fullWidth 属性**
   ```tsx
   <Input label="邮箱" fullWidth />
   ```

4. **提供清晰的 label**
   ```tsx
   <Input label="用户名" required />
   ```

### DON'T ❌

1. **不要硬编码颜色**
   ```tsx
   // ❌ 避免
   <button className="bg-blue-600 text-white">

   // ✅ 使用
   <Button variant="primary">
   ```

2. **不要混用间距单位**
   ```tsx
   // ❌ 避免
   <div className="gap-2 space-y-3 mt-4 mb-5">

   // ✅ 使用
   <div className="space-y-4">
   ```

3. **不要过度嵌套**
   ```tsx
   // ❌ 避免 7+ 层嵌套
   <div><div><div><div><div><div><div>

   // ✅ 使用组件
   <Card><CardBody>
   ```

4. **不要忽略可访问性**
   ```tsx
   // ❌ 避免
   <button disabled>按钮</button>

   // ✅ 使用
   <Button disabled aria-label="此操作当前不可用">
   ```

---

## 📚 参考资源

- [设计令牌文档](../design-system/tokens.ts)
- [Button 组件](../design-system/components/Button.tsx)
- [Input 组件](../design-system/components/Input.tsx)
- [Card 组件](../design-system/components/Card.tsx)
- [DealDesk 重构示例](./2026-09-12-deal-desk-refactor-comparison.md)

---

**创建日期**: 2026-09-12  
**最后更新**: 2026-09-12  
**维护者**: Claude Opus 5  
**版本**: 1.0

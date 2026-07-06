# Delivery Demo Smoke Path

Last updated: 2026-07-06

本文是当前 Controlled Skill / Playbook Runtime 的本地交付演示路径。目标是让维护者在交付前用稳定命令证明：

- Runtime Console 有可讲解的 completed / awaiting approval / retryable failed run；
- sales / knowledge / workflow / draft / support 五类资产落点存在；
- governed trace artifact 仍然脱敏；
- 演示数据只写本地 `.openclaw-data`，不触碰外部系统。

## 1. 适用边界

这条路径用于本地交付烟测，不是生产数据导入。

允许：

- 写入 `.openclaw-data/*.json` 本地演示记录；
- 重复运行 seed/check；
- 从浏览器检查 Home -> Runtime Console -> asset landing -> governed trace copy。

禁止：

- 真实 LLM replay；
- 真实工具调用 replay；
- 新增公开 seed API；
- 绕过 approval / writeback / trace governance；
- 为演示写外部系统。

## 2. 命令级烟测

从仓库根目录运行：

```bash
npm run delivery:demo:seed
npm run delivery:demo:check
```

`delivery:demo:seed` 会幂等写入这些本地记录：

- `delivery-demo-run-completed`
- `delivery-demo-run-awaiting-approval`
- `delivery-demo-run-failed-retryable`
- `delivery-demo-sales-asset`
- `delivery-demo-knowledge-asset`
- `delivery-demo-workflow-sales`
- `delivery-demo-draft`
- `delivery-demo-support-asset`

`delivery:demo:check` 会验证：

- 三个 demo run 均存在；
- completed run 包含 `sales_asset`、`knowledge_asset`、`workflow_run`、`draft`、`support_asset` 写回 receipt；
- awaiting run 有 pending approval；
- failed run 有 retryable step；
- 五类资产记录均存在；
- completed run 的 governed trace artifact 不暴露 unsafe raw text。

成功输出应包含：

```json
{
  "ok": true,
  "diagnostics": []
}
```

如果失败，先看 `diagnostics`，不要手工改 trace 或 fixture 来绕过错误。

## 3. 浏览器演示路径

命令级烟测通过后启动开发服务器：

```bash
npm run dev
```

浏览器路径：

1. 打开 `http://localhost:3000/`。
2. 从 Home 的 controlled playbook cockpit 点击 `Open Runtime Console`。
3. 在 Runtime Console 搜索 `delivery-demo`。
4. 选择 `delivery-demo-run-completed`。
5. 检查 step trace、approval、schema、writeback receipts。
6. 在 Asset landings 检查 sales / knowledge / workflow / draft / support 落点。
7. 点击 `复制脱敏 Trace`，确认复制对象是 governed artifact，不是 raw run record。
8. 可选：打开各 asset landing，确认业务 app 能聚焦对应记录。

辅助演示：

- 选择 `delivery-demo-run-awaiting-approval` 展示 pending approval 控制面。
- 选择 `delivery-demo-run-failed-retryable` 展示 retry eligibility 和失败恢复面板。

## 4. 交付前建议门禁

交付前推荐完整运行：

```bash
git diff --check
npm run delivery:demo:seed
npm run delivery:demo:check
npm test -- src/__tests__/scripts/delivery-demo-data.test.ts src/__tests__/scripts/delivery-demo-scripts.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

已知可接受提示：

- `npm run lint` 和 `npm run build` 可能继续显示 `src/__tests__/components/ShellUI.test.tsx` 中既有的 `<img>` warning。

## 5. 维护路径

如果 controlled runtime 字段变化导致 demo path 失败：

1. 先更新 `scripts/delivery-demo/demo-data.mjs` 的确定性数据。
2. 同步更新 `src/__tests__/scripts/delivery-demo-data.test.ts` 或 `delivery-demo-scripts.test.ts`。
3. 运行 seed/check 和 controlled-runtime gate。
4. 更新本文、`docs/NEXT_STEPS.md`、`docs/ROADMAP.md` 和 `CHANGELOG.md`。

不要把 demo seed 变成公开 API；它应该保持本地、显式、可审查。

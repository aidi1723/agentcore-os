# Runtime UI Delivery Polish Closeout

Last updated: 2026-07-06

本文是 Runtime UI Delivery Polish 阶段的收尾记录。它不是新的 UI 改版规格，而是确认这一阶段已经完成、验证过，并且没有把项目方向带回“大 UI 壳重构”。

## 1. 阶段结论

本阶段已完成。

当前 UI 状态可以描述为：

**Home 保持 controlled playbook cockpit，Runtime Console 增加 delivery handoff 摘要，项目仍不进入全量 UI 重构。**

这次改动只服务于交付可读性：

- 让操作者先看到 recent controlled runs 的交付状态；
- 让 pending approvals 和 retryable failures 更早暴露；
- 让 asset landings 和 governed trace candidates 成为可扫描指标；
- 保留原有 run list、filters、search、selected detail、approval、resume、retry、asset open、governed trace copy 行为。

## 2. 已交付内容

代码：

- `src/lib/executor/runtime/console-summary.ts`
  - 新增 `ControlledRunDeliverySummary`。
  - 新增 `buildControlledRunDeliverySummary()`。
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
  - 新增 `Delivery handoff` 摘要带。
  - 展示 `Recent runs`、`Pending approvals`、`Retryable failures`、`Asset landings`、`Governed trace`。

测试：

- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
  - 覆盖 delivery handoff summary 聚合逻辑。
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
  - 覆盖 Runtime Console 真实渲染新的 handoff summary。

文档：

- `docs/superpowers/specs/2026-07-06-runtime-ui-delivery-polish-design.md`
- `docs/superpowers/plans/2026-07-06-runtime-ui-delivery-polish.md`
- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- 本文档

提交：

- `cec8c77 feat: add runtime UI delivery handoff`

## 3. 截图验证

截图验证已补做。

验证路径：

1. 打开 `http://localhost:3001/`。
2. 如出现首次语言弹层，选择中文。
3. 点击 Home 上的 `打开 Runtime Console`。
4. 定位 Runtime Console 内的 `Delivery handoff` 区域。
5. 确认以下内容在真实 DOM 和截图中可见：
   - `Delivery handoff`
   - `Action required`
   - `Recent runs`
   - `Pending approvals`
   - `Retryable failures`
   - `Asset landings`
   - `Governed trace`

截图文件：

- `output/playwright/runtime-ui-delivery-handoff.png`

浏览器结果：

- console errors: `0`
- console warnings: `9`
- warnings 为当前 dev/browser 环境警告；没有发现阻塞 Runtime Console 渲染的新 error。

说明：

- `output/` 是本地证据目录，不作为源码提交物。
- 截图确认新的 delivery handoff 区域可见，指标卡未遮挡，run list 仍正常显示。

## 4. 验证命令

本阶段最终验证：

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

结果：

- `npm run test:controlled-runtime`：38 files / 198 tests passed。
- `npm run test:core-workflows`：all core workflow regressions passed。
- `npm run lint`：exit 0，只有既有 `<img>` warning。
- `npm run build`：exit 0，只有同一个既有 `<img>` warning。
- `git diff --check`：exit 0。

已知既有 warning：

- `src/__tests__/components/ShellUI.test.tsx`
- `@next/next/no-img-element`

该 warning 本阶段未新增，也不阻塞本次收尾。

## 5. 明确非目标

本阶段没有做：

- 全量 UI 重构；
- 桌面 shell 视觉换皮；
- 新组件库引入；
- 路由重构；
- app window 生命周期改动；
- runtime 执行逻辑改动；
- approval / resume / retry 语义改动；
- writeback 或 governed trace 行为改动；
- production readiness 宣称。

## 6. 收尾判断

本阶段可以收尾。

后续如果继续 UI 工作，只允许围绕交付阻塞项做小范围修复，例如：

- 文案过长导致移动端挤压；
- delivery handoff 指标在真实 demo 数据下缺失；
- Runtime Console 关键操作按钮在截图证据中不可见；
- 浏览器 console 出现新 error。

除此之外，不继续扩大 UI 范围。

## 7. 下一阶段

下一阶段默认回到：

**Trace Operations Hardening**

建议方向：

- governed trace retention / cleanup 的运维边界；
- trace artifact / fixture refresh 的维护者路径；
- fixture replay / replay sandbox 命令的失败诊断和交付说明；
- 不实现真实工具 replay；
- 不新增 playbook；
- 不把本地 demo seed/check 升级为公开 API。

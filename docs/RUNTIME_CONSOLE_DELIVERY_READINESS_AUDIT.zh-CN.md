# Runtime Console Delivery Readiness Audit

Last updated: 2026-07-06

本文是 Runtime UI Reframing 之后的交付审计。目标不是再扩展功能，而是判断当前 Runtime Console 是否已经足够支撑一次“Controlled Skill / Playbook Runtime”产品演示。

## 1. 当前结论

当前分支已经完成命令级 **delivery demo smoke path** 和一次浏览器 smoke evidence，但还不应宣称为完整生产发布。

可以演示的主线是：

1. 从 Home 的 controlled playbook cockpit 进入 Runtime Console。
2. 在 Runtime Console 查看 controlled run 列表、状态、搜索和选中运行详情。
3. 展示 step trace、approval 状态、schema / receipt / asset landing。
4. 对 awaiting approval / failed / resumable run 执行批准、拒绝、继续或重试。
5. 打开写回的 sales / support / knowledge / workflow / draft 资产。
6. 复制 governed trace artifact，证明不会把 raw trace 直接暴露为交付物。

当前审计结论：

- **Ready:** Runtime Console 已具备受控运行检查、人工控制、恢复、资产落点和 governed trace copy 的交付主线。
- **Ready:** 本地 seed/check 已提供固定 demo run、资产记录和 governed trace 脱敏验证。
- **Ready:** 浏览器 smoke 已证明 Home -> Runtime Console -> asset landing -> governed trace copy 在真实 UI 中无阻塞。
- **Remaining:** 发布说法仍应限制为 local delivery demo ready，不宣称 production ready。
- **Deferred:** 真实 replay、新 playbook、更多 fixture expansion、UI 大改和通用 agent shell 扩展都应继续延期。

## 2. 可交付演示主线

推荐演示脚本：

1. 打开首页，说明第一视口现在是 controlled playbook cockpit。
2. 点击 `Open Runtime Console`。
3. 在 `受控运行 Trace` 中筛选或搜索一个 `sales-pipeline-v1` 或 `support-resolution-v1` run。
4. 说明左侧是 run index，右侧是选中 run 的控制面。
5. 展示 step trace：
   - current step；
   - approval count；
   - failed steps；
   - writeback receipts；
   - schema status。
6. 对需要人工处理的 run 展示：
   - `批准步骤` / `拒绝步骤`；
   - `继续执行`；
   - `重试失败步骤`。
7. 在 Asset landings 中打开对应业务资产。
8. 点击 `复制脱敏 Trace`，说明交付物是 governed artifact，不是 raw run record。

## 3. Readiness Matrix

| Area | Current status | Evidence | Delivery decision |
| --- | --- | --- | --- |
| Home entry | Ready | Home cockpit exposes Runtime Console as primary inspection action | Demo entry can start from Home |
| Run index | Ready | Runtime Console lists recent controlled runs, state filters, and text search | Usable for demo |
| Run detail | Ready | Selected run shows state, current step, approvals, failures, assets, and steps | Usable for demo |
| Approval | Ready | Console can approve/reject pending approval step through `/api/agent/approve` | Demo if seeded awaiting run exists |
| Resume | Ready | Console can call controlled run resume route | Demo if resumable run exists |
| Retry | Ready | Console can retry eligible failed step and shows non-retryable reason | Demo if failed retryable run exists |
| Asset landings | Ready | Sales, support, knowledge, workflow, and draft landings open app-specific focus paths | Demo with completed run |
| Governed trace | Ready | Console fetches trace artifact route and copies `{ export, artifact }` | Demo with completed run |
| Runtime diagnostics | Partial | Runtime/sidecar/doctor panels exist but are still mixed with older runtime installation concerns | Keep visible, not the core demo story |
| Fixture/replay visibility | Partial | Governed trace and docs explain fixture/replay gates; UI does not yet summarize fixture gate state | Explain through docs for now |
| Demo repeatability | Ready | `npm run delivery:demo:seed` and `npm run delivery:demo:check` seed and verify deterministic demo state | Use as pre-browser smoke gate |
| Browser evidence | Ready | Playwright smoke opened Home, Runtime Console, `delivery-demo-run-completed`, five asset landings, and governed trace copy with 0 console errors | Use as local delivery evidence |

## 4. 当前阻塞项

### B1. 发布说法仍需保守

当前已经有命令级 smoke 和浏览器 smoke 证据，可以证明：

- 首页能打开 Runtime Console；
- Runtime Console 能加载至少一个 completed controlled run；
- asset landing open actions 可触发；
- governed trace copy 不包含 raw customer / secret payload；
- build gate 和 controlled-runtime gate 仍为 green。

但对外仍只能表述为 local delivery demo ready，不能宣称完整生产发布 ready。

### B2. 演示数据边界已经固定，仍需防止外溢

Runtime Console 的演示数据已经由本地脚本固定：

- `delivery-demo-run-completed`
- `delivery-demo-run-awaiting-approval`
- `delivery-demo-run-failed-retryable`
- sales / knowledge / workflow / draft / support 资产记录

后续仍不能为了演示而绕过 approval、writeback 或 trace governance，也不能把 seed 脚本升级成公开 API。

### B3. Runtime diagnostics 不应喧宾夺主

Runtime Console 上半部分仍保留 runtime / sidecar / doctor 信息。交付演示时应把它作为运行环境状态，不把它讲成产品核心。

## 5. 可延期项

以下事项不阻塞当前 controlled playbook demo：

- 真实 LLM/tool replay。
- 新增第三个 controlled playbook。
- 自动 fixture refresh。
- Runtime Console 大规模视觉重构。
- 首页以外所有 app window 的整体 redesign。
- 通用 skill marketplace。
- 通用 autonomous agent shell。

## 6. 交付前验证门禁

当前交付前至少运行：

```bash
git diff --check
npm run delivery:demo:seed
npm run delivery:demo:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

已知可接受提示：

- `npm run lint` 和 `npm run build` 可能继续显示 `src/__tests__/components/ShellUI.test.tsx` 中既有的 `<img>` warning。

Browser Evidence And Release Readiness Sweep 阶段还应增加浏览器级检查：

```bash
npm run dev
# browser smoke: Home -> Runtime Console -> select controlled run -> asset landing -> governed trace copy
```

已记录的浏览器证据见 [Browser Evidence And Release Readiness Sweep](BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)。

## 7. 下一阶段建议

下一阶段应做 **Governed Fixture And Playbook Expansion Review**：

- 先审查当前 sales/support governed fixture coverage 是否已覆盖所有注册 playbook；
- 判断是否真的需要新 fixture、新 controlled playbook，或先强化 operational retention；
- 输出 focused spec，不直接创建 fixture JSON 或 playbook code；
- 继续禁止真实 replay 和外部系统写入。

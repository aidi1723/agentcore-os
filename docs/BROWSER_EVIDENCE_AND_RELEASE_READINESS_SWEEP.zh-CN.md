# Browser Evidence And Release Readiness Sweep

Last updated: 2026-07-06

本文记录 Delivery Demo Smoke Path 之后的浏览器证据和发布就绪扫尾状态。它不是新功能规格，而是交付前的证据清单和维护路径。

## 1. 当前结论

当前分支已经具备一条可重复的本地交付演示路径：

```bash
npm run delivery:demo:seed
npm run delivery:demo:check
npm run delivery:ready:check
npm run dev
```

浏览器 smoke 已验证：

- Home controlled playbook cockpit 可以打开 Runtime Console；
- Runtime Console 可以加载 seeded `delivery-demo-run-completed`；
- completed run 展示 step trace、approval、writeback receipts；
- Asset landings 展示 sales / knowledge / workflow / draft / support 五类记录；
- `复制脱敏 Trace` 可点击，并调用 governed trace artifact route；
- 浏览器 console 没有 error。

因此，当前交付状态可以描述为：

**Ready for local delivery demo. Not yet a production release claim.**

## 2. Browser Evidence

本次浏览器 smoke 使用：

- dev server: `npm run dev -- -p 3001`
- URL: `http://localhost:3001/`
- tool: Playwright CLI
- screenshot: `output/playwright/delivery-demo-runtime-console.png`

验证路径：

1. 打开 Home。
2. 关闭首次启动语言选择弹层。
3. 点击 `打开 Runtime Console`。
4. 检查 Runtime Console 内的 `受控运行 Trace`。
5. 确认 seeded completed run 的 asset landings：
   - `delivery-demo-sales-asset`
   - `delivery-demo-knowledge-asset`
   - `delivery-demo-workflow-sales`
   - `delivery-demo-draft`
   - `delivery-demo-support-asset`
6. 点击 `复制脱敏 Trace`。
7. 确认服务端请求：
   - `GET /api/runtime/executor/controlled-runs/delivery-demo-run-completed/trace-artifact 200`

浏览器控制台结果：

- errors: `0`
- warnings: dev / preload warnings only

## 3. 已知非阻塞项

- 首次启动时可能出现语言选择弹层；演示时先选择语言即可。
- Runtime diagnostics 仍可能显示本地 AgentCoreOS Runtime binary missing；这属于运行环境诊断，不阻塞受控 Runtime Console 本地演示。
- `npm run lint` 和 `npm run build` 仍有既有 `<img>` warning：
  - `src/__tests__/components/ShellUI.test.tsx`
- 截图位于本地 `output/`，不作为源码提交物；提交前仍需检查不要误提交临时截图、私有日志或真实密钥。

## 4. Release Readiness Sweep Checklist

交付前建议逐项确认：

- [ ] `git status --short` 中没有意外源码改动。
- [ ] `git diff --check` 通过。
- [ ] `npm run delivery:demo:seed` 通过且重复运行幂等。
- [ ] `npm run delivery:demo:check` 通过且 `diagnostics: []`。
- [ ] `npm run delivery:ready:check` 通过，输出 `releaseClaim: "local_delivery_demo_ready"` 且 `productionReady: false`。
- [ ] `npm run test:controlled-runtime` 通过。
- [ ] `npm run test:core-workflows` 通过。
- [ ] `npm run lint` 通过，只有已知 `<img>` warning。
- [ ] `npm run build` 通过，只有已知 `<img>` warning。
- [ ] 浏览器 smoke 可从 Home 打开 Runtime Console。
- [ ] Runtime Console 可展示 `delivery-demo-run-completed` 五类 asset landing。
- [ ] `复制脱敏 Trace` 可调用 governed trace artifact route。
- [ ] 发布文档不宣称生产 ready；只宣称 local delivery demo ready。

`delivery:ready:check` 是浏览器证据前的快速命令级门禁。它聚合 demo check、governed fixture report、fixture summary 和 retention preview，但不启动浏览器、不替代完整 regression / lint / build，也不代表 production ready。

## 5. 下一步建议

下一阶段可以进入 **Governed Fixture And Playbook Expansion Review**，但前提是继续保持以下边界：

- 不新增真实 replay。
- 不新增新 playbook。
- 不把 seed/check 变成公开 API。
- 不为演示绕过 approval、writeback 或 trace governance。
- 任何 fixture / playbook expansion 必须先写 spec / plan，再用 TDD 和 replay gates 收口。

# AgentCore OS 全项目审查与优化收尾报告

日期：2026-07-16

## 结论

本轮完成了 Web 主应用、API/发布链路、Tauri 壳层、Python sidecar 和桌面/移动端 UI 的审查与验证。修复了两个可复现问题：Vitest 会越界扫描本地 Git worktree，以及本地发布 Connector 被出站策略误拦截。生产构建、核心/发布回归、695 个 Vitest、Rust 检查、Python 编译和 sidecar 端到端烟测均通过。

本结论只代表本地工程门禁通过，不代表安装包签名、跨平台打包、真实外部 Connector、真实模型凭证或生产发布已经完成。

## 已完成优化

### 1. 测试发现边界

- `vitest.config.ts` 恢复 Vitest 默认排除规则。
- 明确排除 `.worktrees/**` 和 `.superpowers/**`。
- 避免嵌套 worktree 的测试和 `node_modules` 被重复执行，消除双 React 实例导致的 `Invalid hook call`、第三方依赖测试误收集和 98 个伪失败。

### 2. 本地发布 Connector 与 SSRF 边界

- `network-policy.ts` 新增仅允许 loopback 的 `allowLoopback` 选项。
- 发布分发允许文档约定的 `localhost`、`127.0.0.0/8` 和 `::1` Connector。
- `192.168.0.0/16` 等私网地址仍被拒绝，没有为修复本地 Connector 放宽整个内网。
- 新增网络策略回归测试，并把原“私网 URL”测试夹具从 loopback 改为真实私网地址。

### 3. 质量门禁噪音

- 为 `next/image` 测试替身增加精确 ESLint 说明。
- `npm run lint` 从 1 个警告恢复为零警告、零错误。

## UI 审查

依据 `DESIGN.md` 与 `design-md-ui` 检查桌面首屏、390x844 移动端、语言引导和设置窗口。

- 主工作台保持操作型 cockpit 密度，核心状态、主操作和输入区层级清晰。
- 移动端没有发现文本溢出、按钮遮挡或不可用触控目标。
- 设置窗口可以在完成 hydration/语言引导后正常打开，窗口内容可滚动且信息层级稳定。
- 开发模式出现图片 preload 警告、空会话 404 和一次浏览器运行时 hydration 属性提示；生产构建未复现阻断性错误。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `npm test -- --silent=passed-only --reporter=dot` | 137 个文件、695 个测试全部通过 |
| `npm run test:core-workflows` | 全部核心工作流回归通过 |
| `npm run test:publish` | 发布配置、回执、队列、代理路由和鉴权回归通过 |
| `npm run lint` | 零警告、零错误 |
| `npm run build` | Next.js 生产构建通过，56 个页面/路由完成生成 |
| `cargo check --manifest-path src-tauri/Cargo.toml --quiet` | runtime 暂存后通过 |
| `python3 -m compileall -q ...` | sidecar Python 源码编译通过 |
| `npm run desktop:smoke-test-sidecar` | HTTP、设置、LLM、状态存储、IM bridge、Connector 主链路通过 |
| `git diff --check` | 通过 |

## 残余风险

1. **测试代码独立类型检查**：`npx tsc --noEmit` 仍会报告既有测试夹具和脚本注入类型错误。Next.js 生产构建的类型检查已通过，但应后续建立独立 `tsconfig.test.json` 并逐步清零测试类型债务。
2. **DNS 解析边界**：当前出站策略按 URL hostname/IP 字面值判断；公网域名解析到私网或 DNS rebinding 仍需在真正开放外部 webhook 前增加解析后校验。
3. **桌面发布边界**：本轮只验证 runtime 生成、暂存、Rust 编译和 sidecar 烟测，没有执行签名、公证、跨平台安装包或生产发布。
4. **视觉一致性债务**：语言/运行时引导仍使用较重 blur、渐变和 24-32px 圆角，与 `DESIGN.md` 的克制 operational cockpit 规范有偏差。整体收敛会影响共享壳层，建议作为单独视觉规格处理。
5. **依赖目录卫生**：`npm ls --depth=0` 显示一个 extraneous 的 `@emnapi/runtime`，不影响当前构建，但应在下一次锁文件/依赖维护中用干净安装确认来源。

## 使用的方法

- Safe-Agent 路由场景：`code-review-hardening`。
- 工作流技能：`safe-agent-router`、`systematic-debugging`、`test-driven-development`、`design-md-ui`、`playwright`、`verification-before-completion`。
- 修改保持在测试配置、网络策略、发布分发和对应测试内，没有改变路由、信息架构或业务数据模型。


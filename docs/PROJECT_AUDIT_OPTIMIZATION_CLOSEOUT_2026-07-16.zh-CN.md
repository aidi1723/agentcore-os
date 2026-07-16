# AgentCore OS 全项目审查与优化收尾报告

日期：2026-07-16

## 结论

本轮完成了 Web 主应用、API/发布链路、Tauri 壳层、Python sidecar 和桌面/移动端 UI 的两阶段审查与加固。第一阶段修复 Vitest 越界扫描本地 Git worktree，以及本地发布 Connector 被出站策略误拦截；第二阶段清零严格 TypeScript 基线，消除干净 worktree 对本地输出和父级 ESLint 配置的依赖，并把 webhook 从直接 `fetch` 改为 DNS 全量校验后的固定地址 HTTP(S) 连接。生产构建、核心/发布回归、722 个 Vitest、Rust 检查、Python 编译和 sidecar 端到端烟测均通过。

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
- `.eslintrc.json` 标记为根配置，隔离 worktree 不再级联加载父工作区同名插件。

### 4. 干净工作树确定性

- playbook mutation preflight 的跟踪夹具不再隐式依赖被忽略的 `output/` closeout 证据；测试显式注入绿色上游门禁，同时继续读取和验证受版本控制的 dry-run。
- 隔离 worktree 全量测试从 694/695 恢复为稳定 718/718。
- Tauri Rust 检查明确使用 `npm run desktop:prepare-sidecar` 生成并暂存被忽略的本机 target launcher，不把桌面二进制纳入提交。

### 5. 严格 TypeScript 基线

- 保持根 `tsconfig.json`、`strict: true` 和测试纳入范围不变，`npx tsc --noEmit` 从 87 个错误清零。
- 补齐 Node 子进程测试结果、executor 判别联合、trace 字面量、运行记录和脚本 JSDoc 注入合同。
- playbook 校验器只声明实际消费的不可信上游报告字段，允许负例覆盖错误的 production/publishing 声明，而不伪造完整上游报告。
- 未使用 `as any`、测试排除、`skipLibCheck` 或编译器降级隐藏问题。

### 6. DNS 与固定连接 SSRF 防护

- 新增异步 URL 解析策略，使用 `dns.lookup(..., { all: true, verbatim: true })` 获取全部 A/AAAA 结果；空结果、解析失败、私网结果和公网/私网混合结果均失败关闭。
- literal IP、IPv4-mapped IPv6、IPv6 loopback/link-local/unique-local/site-local/multicast 均按地址策略校验。
- DNS 答案中的特殊用途 IPv4（CGNAT `100.64/10`、benchmarking `198.18/15`、multicast `224/4`、reserved `240/4` 含广播）同样失败关闭。
- `allowLoopback` 只授权 `localhost`、`tauri.localhost` 等明确本地别名或 loopback 字面量；任意公网域名即使解析到 `127.0.0.1` 也会被拒绝，封堵 DNS rebinding 到本机服务。
- 新传输层通过自定义 socket `lookup` 固定已验证的 IP 和地址族，同时保留原 hostname、HTTP `Host` 和 TLS SNI，消除校验后再次解析的 TOCTOU 窗口。
- Node 原生请求不跟随 3xx；响应上限为 20,000 字节；超时和溢出都会销毁请求；策略、DNS、超时、连接和响应过大使用稳定错误码。

### 7. 发布回执兼容性

- `runPublishDispatch` 保留原 payload、manual/dry-run、结构化回执解析、聚合 `ok` 和队列重试语义。
- 3xx 作为不可重试 `redirect` 回执返回；`blocked_url` 与 `response_too_large` 不重试；DNS、超时和连接失败保持可重试 `temporary`。
- 发布回归改用注入传输，不访问公网，并继续验证成功回执、鉴权失败、手动回退、持久化、队列、代理路由和鉴权面。

## UI 审查

依据 `DESIGN.md` 与 `design-md-ui` 检查桌面首屏、390x844 移动端、语言引导和设置窗口。

- 主工作台保持操作型 cockpit 密度，核心状态、主操作和输入区层级清晰。
- 移动端没有发现文本溢出、按钮遮挡或不可用触控目标。
- 设置窗口可以在完成 hydration/语言引导后正常打开，窗口内容可滚动且信息层级稳定。
- 开发模式出现图片 preload 警告、空会话 404 和一次浏览器运行时 hydration 属性提示；生产构建未复现阻断性错误。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 严格 TypeScript 检查通过，零错误 |
| `npm test -- --silent=passed-only --reporter=dot` | 138 个文件、722 个测试全部通过 |
| `npm run test:stability` | 核心工作流、发布回归、lint 和生产构建完整通过 |
| `npm run test:core-workflows` | 全部核心工作流回归通过 |
| `npm run test:publish` | 发布配置、回执、队列、代理路由和鉴权回归通过 |
| `npm run lint` | 零警告、零错误 |
| `npm run build` | Next.js 生产构建通过，56 个页面/路由完成生成 |
| `npm run desktop:prepare-sidecar` + `cargo check --manifest-path src-tauri/Cargo.toml --quiet` | 本机 runtime 暂存后 Rust 检查通过 |
| `python3 -m compileall -q ...` | sidecar Python 源码编译通过 |
| `PYTHON_BIN=<已有 sidecar venv> npm run desktop:smoke-test-sidecar` | 主机 loopback 权限下，HTTP、设置、LLM、状态存储、IM bridge、Connector 主链路通过 |
| `git diff --check` | 通过 |

## 残余风险

1. **Next.js 安全维护**：当前仍为 Next.js 15.1.6，安装过程提示 `CVE-2025-66478` 相关安全升级。框架升级可能影响 App Router、lint 和构建链，应作为下一次独立依赖维护的最高优先级处理并完整回归；本阶段未扩大到框架升级。
2. **桌面发布边界**：本轮只验证 runtime 生成、暂存、Rust 编译和 sidecar 烟测，没有执行签名、公证、跨平台安装包或生产发布。
3. **视觉一致性债务**：语言/运行时引导仍使用较重 blur、渐变和 24-32px 圆角，与 `DESIGN.md` 的克制 operational cockpit 规范有偏差。整体收敛会影响共享壳层，建议作为单独视觉规格处理。
4. **依赖目录卫生**：`npm ls --depth=0` 显示一个 extraneous 的 `@emnapi/runtime`，不影响当前构建，但应在下一次锁文件/依赖维护中用干净安装确认来源。

## 使用的方法

- Safe-Agent 路由场景：`code-review-hardening`。
- 第二阶段工作流：批准设计、隔离 worktree、逐簇严格类型修复、网络红绿测试、差异审查和 `verification-before-completion`。
- 修改保持在测试/脚本合同、网络策略、固定地址传输、发布分发和对应回归内，没有改变路由、信息架构、UI 或业务数据模型。

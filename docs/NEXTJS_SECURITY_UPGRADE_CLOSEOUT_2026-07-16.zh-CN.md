# AgentCore OS Next.js 安全升级收尾报告

日期：2026-07-16  
提交：`1a690bb`（`chore(deps): upgrade Next.js to 15.5.20 security backport`）  
分支：曾隔离于 `chore/nextjs-security-upgrade`，已 fast-forward 合入 `main` 并推送 `origin/main`

## 结论

本轮将 Web 主应用依赖从 Next.js **15.1.6** 升至官方 **15.x backport 安全线 `15.5.20`**，并同步 `eslint-config-next`。范围限定为依赖维护：无产品改版、无路由/信息架构变更、无 React 大版本升级、不跳到 Next.js 16。

本地与隔离 worktree 自动化门禁通过，并完成一次生产态 HTTP 短烟雾（首页、robots、executor health）。**本结论不代表**安装包签名、公证、跨平台打包、真实外部 Connector、真实模型凭证或生产发布已完成。

## 目标与边界

| 项 | 内容 |
| --- | --- |
| 升级目标 | `next` / `eslint-config-next` → `15.5.20`（npm dist-tag `backport`） |
| 明确不做 | Next.js 16、Dependabot 16.x 混并、桌面签名/公证、视觉债清理、无关依赖大扫除 |
| 工作方式 | 隔离 git worktree + 独立分支；验证通过后再合入 `main` |
| 隐私 | 仅提交 `package.json` / `package-lock.json` / 生成型 `next-env.d.ts` / 维护者文档；不提交 `SOUL.md`、`USER.md`、`IDENTITY.md`、`HEARTBEAT.md`、`TOOLS.md`、本地 `output/`、密钥或本机绝对路径 |

## 变更摘要

- `package.json`：`next` 与 `eslint-config-next` 由 `15.1.6` 固定为 `15.5.20`。
- `package-lock.json`：按锁定版本再生。
- `next-env.d.ts`：Next 安装/构建链路更新的类型引用（生成型，无业务逻辑）。
- 维护者文档：`CHANGELOG.md`、`docs/NEXT_STEPS.md`、Stage 2 closeout 残余风险措辞、本收尾报告与文档索引对齐。

未改：`next.config.ts` 双 `distDir` / 可选静态导出策略、App Router 路由树、业务 API 与 executor 语义。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 已安装版本 | `next@15.5.20`、`eslint-config-next@15.5.20` |
| `npx tsc --noEmit` | 通过 |
| `npm test`（Vitest） | 138 个文件、722 个测试全部通过 |
| `npm run lint` | 零 ESLint 警告/错误（`next lint` 在 15.5 提示未来将迁移至 ESLint CLI，本轮不扩 scope） |
| `npm run build` | Next.js 15.5.20 生产构建成功，56 个页面/路由生成 |
| 生产短烟雾 | `next start` 后 `GET /`、`GET /robots.txt`、`GET /api/runtime/executor/health` 均 HTTP 200；health 返回 `status: "healthy"` |
| 隐私扫描 | 拟推送 diff 无本机绝对路径、无私有身份文件、无密钥材料纳入提交 |

说明：隔离 worktree 下 Next 可能提示“检测到父目录与 worktree 双 lockfile”；合入主树后该提示通常不再适用。未因此改动 `outputFileTracingRoot` 或扩大配置 scope。

## 文档对齐

- `CHANGELOG.md`：Unreleased 增加 *Next.js Security Maintenance*。
- `docs/NEXT_STEPS.md`：完成项与残余风险改为“已上 15.5.20；浏览器全量回归与 Next 16 仍为后续”。
- `docs/PROJECT_AUDIT_OPTIMIZATION_CLOSEOUT_2026-07-16.zh-CN.md`：Stage 2 当时仍为 15.1.6 的历史表述保留，并指向本轮独立完成。
- `docs/DOCUMENTATION_INDEX.zh-CN.md`：索引与总述同步本收尾。
- Stage 2 设计/计划中的“Next 仍为下一依赖优先项”改为“已完成 15.5.20 安全维护，16.x 另立周期”。

## 残余风险（非生产声明）

1. **交互式浏览器 / 全量 App Router 回归**：自动化与短烟雾已绿；未替代完整人工浏览器清单或桌面壳内嵌 WebView 全量验收。
2. **Next.js 16**：仓库上可能出现 Dependabot 的 16.x 分支；与本轮 **15.5.20 backport** 刻意分离，需独立兼容性评估，禁止与本刀混并。
3. **桌面发布边界**：签名、公证、跨平台安装包仍不在本轮范围。
4. **视觉一致性债务**：与 `DESIGN.md` 相关的装饰性样式债未处理。
5. **`next lint` 弃用路径**：15.5 起提示未来移除 `next lint`；迁移 ESLint CLI 可作为后续工程卫生项，非本轮阻塞。

## 明确未声称

- 生产就绪（production ready）
- 已完成签名安装包或公证
- 真实外部 Connector / 真实生产凭证可用
- CVE 编号的法律或合规认证（本轮依据官方 15.x backport 安全线做依赖维护）

## 后续建议顺序

1. 主工作区干净克隆或现有树执行 `npm install`，确认与 lockfile 一致。
2. 需要时再做桌面 `prepare-sidecar` / smoke（与框架升级解耦）。
3. 视觉债、签名发布、Next 16 评估各自开独立周期。

# AgentCore OS 目录审查收尾报告

日期：2026-09-28  
分支：`main`  
包版本：仍为 `1.3.0-beta.1`，本轮没有另发版本号

## 结论

本轮处理了 2026-09-28 对 `agentcore-os` 的目录审查。本地 API 现在要求请求地址和 `Host` 头同时指向本机，开发与启动脚本绑定 `127.0.0.1`，模型出站地址拒绝回环和私网。27 个窗口改由设计系统版本运行，5 个仍用完整实现。文档里没有实验记录的「100 次邮件分类、错误率 0%」已改成仓库里能核对的能力边界。CI 会执行 Vitest，安全审计失败会让流水线变红。

全量测试 142 个文件、735 项通过。`npx tsc --noEmit` 通过。`npx next lint` 退出码为 0，并保留一条既有图片元素警告。本机 HTTP 抽查通过。首页可以打开。

本结论只代表这次审查项已经落地并通过上述检查。它不代表安装包签名、跨平台打包、真实外部 Connector、真实模型凭证或生产发布已经完成。

## 已完成修复

### 1. 本地 API 门禁

- `isLocalRequest` 改为请求 URL 主机必须在本机名单内；只要带了 `Host` 头，该头也必须是本机。两边不再用「或」放行。
- 每个 `src/app/api/**/route.ts` 都调用 `rejectUnauthorizedLocalApiRequest`、`createStateRouteHandlers` 或 `createDeleteHandler`。扫描测试会拦住漏掉门禁的新路由。
- `dev`、`dev:clean`、`start`、`stable` 都加上 `-H 127.0.0.1`。Next.js 15 默认主机名是 `0.0.0.0`，脚本不再沿用这个默认值。

### 2. 模型出站地址

- `requestServerLlmText` 在请求前用 `isAllowedOutboundUrl` 检查 chat completions 地址。
- `/api/kimi/test` 对候选 `/models` 地址做同样检查。不允许的地址返回 400，错误为「Base URL 不在允许的外连范围内」。
- 这一层与现有 `/api/llm/chat` 一致，只检查字面地址，不做 DNS 全量解析。发布 webhook 仍使用更严格的 DNS 固定连接。

### 3. 设计系统运行入口

- `src/apps/registry.ts` 中 27 个窗口改为加载 `*.v2`。
- 设置、发布台、运行控制台的设计系统草稿缺少原有操作，已删除，运行入口继续用完整实现。
- 行业应用中心和知识库的设计系统版本没有通过现有聚焦测试，运行入口也继续用完整实现。知识库草稿里的起草按钮已改为跳到发布台，但该文件仍未接入注册表。
- 删除未被引用的 `src/components/design-system`。保留 `src/design-system` 作为正在使用的组件来源。
- 已切换窗口的旧实现文件仍留在仓库里。现有组件测试只覆盖成交台和客服副驾，不能据此删除其余旧文件。

### 4. 文档口径

- `README.md`、`PROJECT_INTRODUCTION.md`、`docs/PROJECT_SUMMARY.md`、`docs/TECH_BLOG_3000.md` 去掉没有测试、夹具或脚本支撑的 100 次邮件研究，以及 23%、18%、12%、0% 这一组对比。
- 替换后的文字只描述本机门禁、出站策略、执行器审批与追踪，以及 27/32 窗口的接入状态。

### 5. CI、依赖和审计

- `.github/workflows/ci.yml` 在 lint 之后执行 `npm test`，再执行 build。
- `.github/workflows/security-audit.yml` 去掉 `continue-on-error`。审计命令改为 `--omit=dev`，并显式使用 `https://registry.npmjs.org`。镜像源 `registry.npmmirror.com` 的审计接口会返回 404。
- `next` 与 `eslint-config-next` 从 `15.5.20` 固定到 `15.5.26`。
- `postcss` 固定为 `8.5.28`，并用同版本 `overrides` 去掉 Next 嵌套的 `postcss@8.4.31`。没有跳到 Next.js 16。
- 生产依赖 `npm audit --omit=dev --audit-level=moderate` 为 0 个漏洞。全量 `npm audit --audit-level=high` 通过。Vitest 仍有一条中等级别的已知问题，修复需要升到 Vitest 5，本轮没有做这个破坏性升级。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `npx vitest run` | 142 个文件、735 项全部通过，耗时 10.64 秒 |
| `npx tsc --noEmit` | 通过 |
| `npx next lint` | 退出码 0；`CreativeStudioAppWindow.v2.tsx` 有一条 `@next/next/no-img-element` 警告 |
| 本机 `POST /api/copy/generate` | 200 |
| 同一请求伪造 `Host: 10.1.2.3` | 403 |
| 本机 `POST /api/kimi/test`，`baseUrl` 为 `http://127.0.0.1:9` | 400，错误为「Base URL 不在允许的外连范围内」 |
| `npm run dev` | Next.js 15.5.26，Local 与 Network 均为 `http://127.0.0.1:3000` |
| 浏览器打开 `http://127.0.0.1:3000/` | 首页标题和桌面壳正常加载，没有错误遮罩 |

新增回归：

- `src/__tests__/lib/server/api-security.test.ts`
- `src/__tests__/lib/server/direct-llm.test.ts`
- `src/__tests__/app/api/local-route-guard.test.ts`
- `src/__tests__/apps/registry-wiring.test.ts`

## 有意留下的项

- 设置、发布台、运行控制台这几个超长窗口没有拆文件。
- 历史报告和已切换窗口的旧实现没有删除。
- 模型请求没有改成发布 webhook 那套 DNS 全量解析。
- Vitest 5 升级没有做。
- 开发服务会把 `next-env.d.ts` 的类型引用改到 `.next-dev`。该改动是本地 `distDir` 的副作用，已还原，不纳入提交。
- 浏览器完成了首页加载。自动审查拦住了继续点击窗口的操作，因此没有逐个点开 27 个设计系统窗口。

## 未纳入本次提交的本地文件

工作区里还有此前就存在、与本轮修复无关的未跟踪文件：`DESIGN_SYSTEM_MIGRATION_REPORT.md`、`TECH_BLOG.md`、`TECH_BLOG_SHORT.md`、`TESTING_CHECKLIST.md`。它们没有进入这次提交。

# AgentCore OS 公开发布说明

这份文档用于说明当前 AgentCore OS 仓库的公开发布边界、交付声明和发布前检查路径。

## 当前公开口径

当前推荐公开评估版本：`v1.3.0`。

当前交付状态：

- 可以声明 **local delivery demo ready**；
- 不声明 **production ready**；
- 不把 DMG / EXE 安装包作为默认分发承诺；
- 真实 replay、外部系统写入和生产级运维边界仍不属于当前公开声明。

AgentCore OS 当前应被描述为：

> 一个本地优先的 Controlled Skill / Playbook Runtime，用于按固定 skill / playbook 流程执行任务，并通过 durable approval、trace governance、失败恢复和 approved asset writeback 保证过程可控。

当前 `main` 分支适合本地评估和交付演示，不应被描述为生产级发布。生产级运维、真实 replay、长期 retention 操作和外部系统集成保证，需要后续单独实现和验证。

## 当前公开边界

公开仓库应重点呈现：

- AgentCore OS 作为产品名和公开项目身份；
- Controlled Skill / Playbook Runtime 作为当前工程核心；
- Runtime Console 作为 controlled run 检查、审批、恢复、资产落点和 governed trace 导出的操作面；
- `sales-pipeline-v1` 和 `support-resolution-v1` 作为当前已覆盖的 controlled playbook；
- 通过 deterministic seed/check、governed fixture gates、retention preview 和 browser evidence 支撑本地 demo readiness；
- 命令行安装 / 从源码运行作为当前推荐评估路径。

公开仓库不应宣称：

- production ready；
- 真实 LLM / tool replay；
- 自动 fixture refresh；
- replay 期间对外部系统写入；
- DMG / EXE 安装包是默认分发路径；
- 历史兼容命名已经全部清除。

## 快速本地交付门禁

公开演示或发布 sanity check 前，先运行：

```bash
npm run delivery:ready:check
```

该命令聚合：

- `npm run delivery:demo:check`
- `npm run trace:fixtures --silent`
- `npm run trace:fixtures:summary --silent`
- `npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20`

成功输出必须包含：

```json
{
  "releaseClaim": "local_delivery_demo_ready",
  "productionReady": false
}
```

这个门禁不替代完整 regression、lint、build 或人工浏览器 smoke。

## 开源卫生门禁

公开交付、仓库展示或发布前，再运行本地开源卫生门禁：

```bash
npm run release:hygiene:check
```

该命令检查：

- 必备公开治理文档；
- `package.json` 许可证元数据；
- tracked build / private artifact 路径；
- 公开发布文档是否提到 `delivery:ready:check`；
- 公开发布文档是否避免正向 production ready 声明。

该门禁里的 secret pattern review 只作为 warning。它只报告文件级命中数量供人工复查，不证明仓库完全没有密钥。

成功输出必须包含：

```json
{
  "ok": true,
  "productionReady": false
}
```

## 完整本地交付前门禁

当仓库准备进入最终本地交付前检查时，运行完整 handoff gate：

```bash
npm run release:handoff:check
```

该命令聚合：

- `npm run release:hygiene:check`
- `npm run delivery:ready:check`
- `npm run test:controlled-runtime`
- `npm run test:core-workflows`
- `npm run lint`
- `npm run build`
- `git diff --check`

成功输出必须包含：

```json
{
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false
}
```

这个门禁不会发布、打 tag、上传 artifact、打包安装器或创建 GitHub Release。

## 本地交付证据快照

完整本地 handoff gate 通过后，可以用下面命令保存一份本地证据文件：

```bash
npm run release:handoff:snapshot
```

该命令会运行 `release:handoff:check`，解析它的 JSON 报告，记录 git branch、commit 和 short status 上下文，并把带时间戳的 JSON 快照写入：

```text
output/release-handoff/
```

成功输出包含：

```json
{
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

这些 snapshot 只是本地 handoff evidence，不是已发布 release artifact，默认不应提交到源码仓库。

交付审查前，可以用下面命令只读校验本地 snapshot：

```bash
npm run release:handoff:snapshot:check -- <snapshot.json>
```

该 validator 会检查 snapshot schema、内嵌 `release:handoff:check` 报告结构，以及 `productionReady: false`、`publishingPerformed: false`、`evidenceOnly: true` 等发布边界字段。它不会发布、上传、打 tag、打包或修改 evidence 文件。

如果需要复核最近的本地证据，而不是手工查找带时间戳的文件，可以运行：

```bash
npm run release:handoff:snapshot:index -- --check --limit 5
```

该 index 命令是只读的。它会按新到旧列出本地 snapshot，并可校验列出的文件；它不会创建 evidence、修改 evidence、发布、上传、打 tag、打包安装器、创建 GitHub Release、运行浏览器烟测或声明 production readiness。

如果需要确认最新本地证据对应当前源码提交，可以运行：

```bash
npm run release:handoff:evidence:check
```

该 freshness 命令是只读的。它会校验最新 snapshot，并比较 `snapshot.git.commit` 与当前 `HEAD`。如果失败原因是 evidence 过期，应重新运行 handoff gate 并生成新的 snapshot，不应直接修改 evidence 文件。

## 完整发布前验证

公开发布说明、外部演示或交付前，建议运行：

```bash
npm run release:handoff:check
npm run release:handoff:snapshot
npm run release:handoff:snapshot:check -- <snapshot.json>
npm run release:handoff:snapshot:index -- --check --limit 5
npm run release:handoff:evidence:check
```

如果聚合门禁失败，需要复现具体子命令时，再按 JSON 输出里的 failed check 单独运行对应命令。

人工浏览器证据仍需单独确认：

- 如有需要，先 seed demo 数据；
- 打开 Home；
- 打开 Runtime Console；
- 检查 `delivery-demo-run-completed`；
- 确认 sales / knowledge / workflow / draft / support 五类 asset landing；
- 复制 governed trace artifact。

当前浏览器证据见：

- `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md`
- `docs/RUNTIME_UI_DELIVERY_POLISH_CLOSEOUT.zh-CN.md`

## 历史兼容说明

部分历史名称仍作为兼容细节存在。这些不是当前公开定位。

可能仍出现在代码或文档中的兼容项：

- `.openclaw-data` 本地数据目录；
- 旧 `openclaw.*` 本地 / 浏览器状态迁移路径；
- 仍未完全替换的 legacy route 或文件名；
- 历史 release notes 中的 OpenClaw-era migration 描述。

这些内容应被解释为兼容或历史说明，而不是当前产品身份。

## 对外入口

建议公开入口：

- 主仓库 GitHub：<https://github.com/aidi1723/agentcore-os>
- 国内镜像 CNB：<https://cnb.cool/aidiyangyu/agentcore-os>
- GitHub Releases：<https://github.com/aidi1723/agentcore-os/releases>

当前推荐安装方式：**命令行安装 / 从源码运行**。

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

中文用户建议阅读：

- `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- `docs/COMMAND_LINE_INSTALL.zh-CN.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/NEXT_STEPS.md`

## 对外说明建议

可以这样描述：

> AgentCore OS 是一个本地优先的 Controlled Skill / Playbook Runtime，用于按固定业务流程运行 AI 工作流，并通过人工审批、trace governance、失败恢复和 approved asset writeback 保证执行过程可控。当前分支已经具备 Runtime Console 本地交付演示路径；production ready、真实 replay 和安装包默认分发仍不属于当前公开声明。

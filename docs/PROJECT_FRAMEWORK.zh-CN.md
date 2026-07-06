# AgentCore OS 项目框架总纲

Last updated: 2026-07-06

## 1. 本次大改的结论

AgentCore OS 的主线已经从“做一个 AI OS 壳 / 多 App 工作台”调整为：

**可控 Skill / Playbook Runtime。**

项目不再以增加更多窗口、更多应用、更多开放式 agent 能力为核心目标。后续开发优先围绕固定 playbook 的可靠执行：

- 固定步骤来源
- 受限工具调用
- 人工审批阻断点
- durable run / trace / approval
- 可恢复执行
- 结构化资产写回
- Runtime Console 可观察和可操作

旧的桌面 UI、业务 App、Solutions Hub、Knowledge Vault 仍然保留，但它们的角色要重新定义：

**UI 是操作面，App 是业务面，Runtime 才是项目核心。**

## 2. 项目目标

AgentCore OS 要解决的问题不是“模型能不能回答”，而是：

**一个 agent 能否按系统确认过的步骤，稳定、安全、可审计地完成一条业务流程，并把结果沉淀成可复用资产。**

具体目标：

- 让工作流步骤由 playbook 定义，而不是由 LLM 临场发挥。
- 让每一步输入、输出、工具、审批和失败处理都有 schema 和 trace。
- 让人工审批成为状态机节点，而不是 UI 文字。
- 让失败、断流、刷新、恢复都能通过 durable runtime state 继续处理。
- 让 approved output 写回业务资产层，未批准内容不得进入高信任资产。
- 让 Runtime Console 成为运行、审批、恢复、复盘的主控制面。

## 3. 非目标

短期明确不做：

- 不继续扩展“大而全 OS 壳”视觉表达。
- 不新增更多无关业务 App。
- 不做普通 skill 集合。
- 不做开放式多 agent 市场。
- 不让 LLM 默认决定流程顺序、工具边界或写回目标。
- 不把浏览器组件状态当作 runtime 真源。

这些不是永远不能做，而是在 controlled runtime 成熟前不进入主线。

## 4. 当前框架分层

```text
User / Trigger
  -> Playbook Resolver
  -> Plan Validator
  -> Runtime State Machine
  -> Step Runner
  -> Tool Gateway
  -> Approval Gate
  -> Trace Store
  -> Asset / Memory Writeback
  -> Runtime Console
```

### 4.1 Playbook Resolver

根据 trigger、scenario、workflow、role 选择受控 playbook。当前已落地的主链路是 `sales-pipeline-v1` 和 `support-resolution-v1`。

### 4.2 Plan Validator

校验 step id、顺序、工具 allowlist、审批要求、schema、写回目标。验证失败必须拒绝执行。

### 4.3 Runtime State Machine

管理 controlled run 的状态：`running`、`awaiting_approval`、`completed`、`failed`、`cancelled`。

### 4.4 Step Runner

执行已验证的 step，记录输入输出、工具结果、schema validation、attempts 和错误。

### 4.5 Approval Gate

把 `review` / `manual` step 转换为 durable pending approval，等待 approve / reject 后再继续。

### 4.6 Trace Store

保存计划、步骤、审批、工具、失败、写回 receipt，使每次执行可复盘。

### 4.7 Asset Writeback

只把 approved output 写入高信任业务资产。目前 `sales_asset`、`support_asset`、`knowledge_asset`、`workflow_run` 和 `draft` 已接入 server-backed store。

### 4.8 Runtime Console

展示 recent controlled runs、trace、approval、resume、retry、asset landing、governed trace copy，并承接 fixture/replay 维护入口的人工操作路径。

## 5. 当前实现状态

已完成：

- `sales-pipeline-v1` 固定 playbook。
- `support-resolution-v1` 固定 playbook。
- playbook resolver / validator / schema validation 基线。
- controlled execution run durable store。
- durable approval record。
- controlled run resume route。
- client stream loss / approval in-flight recovery。
- failed step retry / restart policy 和 console-initiated recovery audit metadata。
- approved final writeback 到 sales / support / knowledge / workflow / draft 资产。
- Runtime Console trace landing。
- Runtime Console approve / reject / resume / retry。
- Runtime Console asset id/source key 搜索与 Deal Desk / Support Copilot / Knowledge Vault / Industry Hub / Publisher 打开动作。
- Deal Desk、Support Copilot、Knowledge Vault record-level asset focus。
- governed trace artifact、local trace artifact route、Runtime Console 脱敏 trace copy。
- governed trace fixture builder、fixture replay runner、fixture catalog、catalog report、JSON summary、人读 summary、failure harness 和 builder CLI。
- fixture refresh workflow、replay contract、CI gate guide、catalog coverage guide、operational runbook。

仍未完成：

- Fixture replay 目前仍是 metadata-only 合约校验。
- 真实 LLM / tool replay 还没有实现。
- real replay 的 sandbox、credential isolation、approval simulation、store isolation、side-effect blocking 和 replay result ownership 已在 `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md` 文档化。
- 因此下一阶段只能先做 Replay Sandbox Contract Types，不能直接写真实 replay 执行代码。

## 6. 文档体系

后续文档以这份总纲为入口：

- 项目框架总纲：`docs/PROJECT_FRAMEWORK.zh-CN.md`
- 可控 Runtime 开发手册：`docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- 架构说明：`docs/ARCHITECTURE.md`
- 执行器收口说明：`docs/EXECUTOR_CONVERGENCE.zh-CN.md`
- 状态盘点：`docs/STATE_INVENTORY.zh-CN.md`
- 路线图：`docs/ROADMAP.md`
- 当前执行 backlog：`docs/NEXT_STEPS.md`
- Real Replay 边界：`docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- 设计规范：`DESIGN.md`
- 变更记录：`CHANGELOG.md`
- 具体实施计划：`docs/superpowers/plans/*`
- 具体设计规格：`docs/superpowers/specs/*`

维护规则：

- 总纲写“方向和边界”。
- 开发手册写“runtime 规则和技术标准”。
- Roadmap 写“阶段优先级”。
- Next Steps 写“下一批可执行任务”。
- Plans / Specs 写“某一阶段的可实施方案”。
- Changelog 写“已经发生的事实”。

## 7. 维护路径

### 7.1 新功能准入

任何新功能必须至少满足一项：

- 提高 playbook 确定性。
- 提高工具边界安全性。
- 提高审批可见性。
- 提高 trace 可复盘性。
- 提高资产写回质量。
- 提高失败恢复能力。

否则默认不进入主线。

### 7.2 改动顺序

1. 先写 spec。
2. 再写 plan。
3. 先写失败测试。
4. 实现最小可用改动。
5. 跑 controlled runtime 门禁。
6. 更新开发文档和 changelog。
7. 小步提交。

### 7.3 默认验证门禁

受控 runtime 相关改动至少运行：

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

如果只改纯文档，可运行：

```bash
git diff --check
```

### 7.4 不允许的维护方式

- 不用 prompt 代替 schema。
- 不用 UI state 代替 durable runtime state。
- 不用 summary 文本代替结构化 receipt。
- 不绕过 executor core 新增执行 API。
- 不把未审批输出写入高信任资产。
- 不在没有测试的情况下改执行状态机。

## 8. 下一步开发方向

### P0. Real Replay Boundary Design

目标：

- 已在 `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md` 定义 replay sandbox、credential isolation、approval simulation、store isolation、side-effect blocking 和 replay result ownership。
- 明确哪些 replay 输入来自 governed artifact / fixture，哪些字段必须继续脱敏。
- 明确 real replay 的失败输出、人工审批模拟、资产写回禁止规则和审计归属。

### P1. Replay Sandbox Contract Types

目标：

- 在写 no-side-effect prototype 前，先新增 TypeScript-only replay contract types。
- Contract types 覆盖 replay input、sandbox context、credential policy、approval simulation、store isolation、side-effect policy 和 replay result artifact。
- 该阶段仍不允许 LLM replay、不允许 tool execution、不允许 route calls、不允许 store 读写、不允许资产写回。

### P2. No-Side-Effect Replay Sandbox Prototype

目标：

- 只有在 P0 边界审查通过后，才允许实现最小 no-side-effect sandbox prototype。
- Prototype 不允许调用生产凭据、不允许写 store、不允许写资产、不允许绕过 approval simulation。
- 输出必须落在 replay result artifact，而不是业务资产层。

### P3. Governed Fixture / Playbook Expansion

目标：

- 只有当 sales/support fixture gate 稳定后，才扩展新 fixture 或新 playbook。
- 新 fixture 必须通过 redaction、approval、writeback metadata、stable identity 和 catalog coverage 审查。
- 新 playbook 必须先进入 spec / plan / TDD / fixture replay 边界，而不是直接接真实工具。

### P4. Operational Retention And Maintenance Hardening

目标：

- 将 governed trace operational runbook 转成更稳定的维护节奏。
- 继续收紧 raw trace retention、fixture refresh stop condition、summary/harness drift 处理。
- 保持 `trace:fixtures` 作为机器可读自动化合同，`trace:fixtures:summary` 作为人读 triage。

### P5. Runtime-Serving UI / App Polish

目标：

- 只做服务 runtime operation 的 UI / app polish。
- 不为了“OS 感”新增窗口、装饰层或无关业务面。
- 任何 UI 改动必须帮助操作者理解 run state、approval、failure、trace、fixture/replay 或 asset landing。

## 9. 判断项目是否跑偏

如果一个阶段的主要成果是：

- 新窗口更多了，
- 视觉更像 OS 了，
- prompt 更长了，
- demo 更炫了，
- 但 run 不能恢复、审批不能审计、结果不能写回、失败不能复盘，

那就是跑偏。

如果一个阶段的主要成果是：

- 步骤更固定，
- 工具更受限，
- 审批更清晰，
- trace 更完整，
- 失败更可恢复，
- 资产更可信，

那就是正确方向。

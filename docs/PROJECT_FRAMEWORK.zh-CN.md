# AgentCore OS 项目框架总纲

Last updated: 2026-07-07

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

### 1.1 和传统 Skill / AI OS 壳的区别

传统 skill 解决的是“怎么做”的问题，通常表现为提示词、步骤建议、工具说明、输出格式或 SOP。它可以沉淀经验，但不天然负责 durable runtime state、审批阻断、失败恢复、trace governance 和资产写回。

传统 AI OS 壳解决的是“从哪里用”的问题，通常表现为桌面、窗口、应用入口、聊天界面和多工具导航。它可以改善交互，但如果没有受控 runtime，agent 仍可能临场决定流程顺序、跳过审批、越过工具边界或把未批准结果写入高信任资产。

AgentCore OS 当前解决的是“如何可靠执行”的问题：

- skill / playbook 描述业务流程；
- Runtime 读取并校验流程；
- Step Runner 按固定步骤执行；
- Tool Gateway 限制工具边界；
- Approval Gate 把人工复核变成状态机节点；
- Trace Store 保留可审计执行证据；
- Asset Writeback 只沉淀 approved output；
- Runtime Console 提供运行、审批、恢复、复盘和交付 handoff。

因此，本项目不是普通 skill 集合，也不是继续扩展 AI OS 外壳，而是一个让 skill / playbook 进入可控执行状态机的 runtime。

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
- `npm run playbook:control:audit` 本地只读控制链路审计，覆盖 playbook lifecycle、deprecated replacement、catalog、schema、tool boundary、approval gate、failure policy、writeback/result asset alignment、default runtime guardrails 和 fixture coverage。
- `npm run playbook:lifecycle:review` 本地只读 lifecycle 复审诊断，覆盖 active playbook 的 next review due / overdue 维护信号。
- `npm run playbook:lifecycle:handoff` 本地只读 version/deprecation handoff checklist，聚合 control audit 与 lifecycle review，汇总 lifecycle status counts 和 deprecated replacement chains。
- `npm run playbook:lifecycle:change:check -- --proposal <path>` 本地只读 proposal-intake gate，检查 playbook lifecycle 变更提案是否声明 spec/plan、必需命令、fixture expectation 和 deprecation metadata。
- `npm run playbook:lifecycle:migration:plan:check -- --plan <path>` 本地只读 migration planning gate，检查 playbook lifecycle 迁移计划是否声明 linked proposal、planned changes、rollback、fixture review、必需命令和 no-mutation policy。
- `npm run playbook:lifecycle:sequence:check -- --sequence <path>` 本地只读 maintenance sequence gate，检查 proposal check、migration plan check、handoff、fixture gate 和 controlled runtime test 是否按顺序声明，并保持 no-mutation / no-publish policy。
- `npm run playbook:lifecycle:sequence:evidence:check -- --evidence <path>` 本地只读 sequence evidence gate，检查已记录 evidence 是否覆盖 sequence 顺序、green command results、handoff/fixture/runtime 证据以及 no-mutation / no-publish summaries。
- `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence <path>` 本地只读 sequence evidence freshness/provenance gate，检查 source commit、sequence digest 和 max-age freshness。
- `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence <path>` 本地只读 sequence evidence doctor，归类 freshness/provenance 状态并给出下一步本地命令。
- `npm run playbook:lifecycle:maintenance:ready -- --evidence <path>` 本地只读 maintenance readiness gate，聚合 lifecycle handoff 与 sequence evidence doctor。
- `npm run playbook:lifecycle:mutation:approval:check -- --approval <path>` 本地只读 mutation approval receipt gate，检查 readiness green 后的结构化批准回执和 no-execution / no-write / no-publish 边界。
- `npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>` 本地只读 mutation dry-run gate，检查批准后的拟变更 playbook target、fixture impact 和 dry-run-only 边界。
- `npm run project:closeout:check -- --evidence <path> --dry-run <path>` 本地只读 controlled-runtime 收尾门禁，聚合 control audit、maintenance readiness、mutation dry-run 和 delivery readiness，明确当前里程碑可收尾但不等于 production ready。
- `npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>` 本地只读 Productionization Preparation preflight，要求 closeout、dry-run、approval、target scope 与 no-side-effect boundary 全绿后，才允许进入真实 mutation executor 的人工实现审查。
- `npm run playbook:lifecycle:mutation:executor:preview -- --manifest <path> --evidence <path> --dry-run <path>` 本地只读 mutation executor preview，重新跑 preflight，校验 manifest、dry-run 声明的目标 scope、当前 SHA-256、next content SHA-256 和 executor-only 边界。
- `npm run playbook:lifecycle:mutation:executor:apply -- --manifest <path> --evidence <path> --dry-run <path> --confirm-apply` 本地受控 mutation executor apply，只允许显式确认后的 registered playbook 文件替换；不刷新 fixture、不写 store、不调用外部 connector、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:post-apply:sequence:check -- --sequence <path>` 本地只读 post-apply audit sequence gate，要求 mutation apply report 已完成，并声明 apply 后必须按 control audit、lifecycle handoff、governed fixture gate、controlled-runtime、core-workflows 和 `git diff --check` 顺序完成审计；在审计证据存在前不得刷新 fixture、发布或宣称 production ready。
- `npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence <path>` 本地只读 post-apply audit evidence gate，要求已记录命令结果严格匹配 post-apply sequence、全部 exit 0，并保留不刷新 fixture、不写 store、不外部写入、不发布、不宣称 production ready 的边界。
- `npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff <path>` 本地只读 fixture refresh handoff gate，要求 post-apply evidence green、目标 playbook 对齐、fixture id 明确、人工 review checklist 完整，并保持不生成候选 fixture、不替换 committed fixture、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review <path>` 本地只读 candidate fixture review gate，要求 fixture refresh handoff green、catalog fixture id 对齐、候选 fixture validation/replay green、敏感标记检查无命中、人工 review evidence 完整，并保持不替换 committed fixture、不刷新 fixture、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff <path>` 本地只读 fixture replacement handoff gate，要求 candidate fixture review green、目标/path 对齐、committed fixture path 限定在 governed fixtures、rollback evidence 完整、post-replacement validation plan 完整，并保持不替换 committed fixture、不刷新 fixture、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence <path>` 本地只读 post-replacement fixture evidence gate，要求 fixture replacement handoff green、replacement summary 对齐、handoff/fixture/runtime/core/diff command evidence 全部 green，并保持不运行命令、不替换 fixture、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review <path>` 本地只读 release handoff review gate，要求 post-replacement evidence green、release handoff/check/snapshot/status/audit/diff command evidence 全部 green、reviewer acceptance 和 rollback notes 完整，并保持不运行 release 命令、不生成 snapshot、不发布、不宣称 production ready。
- `npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary <path>` 本地只读 handoff summary gate，要求 release handoff review green、维护者 summary、命令 summary、risk/deferred items、rollback notes 完整，并保持不运行命令、不生成 snapshot、不发布、不宣称 production ready。
- `npm run delivery:candidate:check -- --candidate <path>` 本地只读 delivery candidate gate，要求 handoff summary green、delivery readiness green、完整回归/lint/build/diff 证据 green、文档对齐、risk/rollback 完整，并保持不运行完整命令、不发布、不打 tag、不打包、不上传、不宣称 production ready。
- `npm run release:production-policy:check -- --policy <path>` 本地只读 production release policy gate，要求 delivery candidate green、ordered command evidence green、packaging/tag/upload/deployment/external writes/monitoring/rollback policy sections 完整、risk/rollback 边界完整，并保持 policy-only：不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。
- `npm run release:production-approval:check -- --approval <path>` 本地只读 production release approval packet gate，要求 production policy green、reviewer/scope/expiry/rollback owner/monitoring owner/release action decisions 完整，并保持 approval-packet-only：不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。
- `npm run release:execution-plan:check -- --plan <path>` 本地只读 release execution planning gate，要求 production approval green、ordered command evidence green、packaging/tag/upload/deployment/external writes planned actions 完整、rollback/monitoring/credential boundary 完整，并保持 planning-only：不运行命令、不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。
- `npm run release:package-build:gate:check -- --gate <path>` 本地只读 package build execution gate，要求 release execution plan green、package build request、source/supply-chain review、ordered command evidence、rollback/monitoring/artifact handling/credential boundary 完整，并保持 gate-only：不运行 `desktop:package`、不创建 artifact、不发布、不打 tag、不上传、不部署、不使用凭证、不宣称 production ready。
- `npm run release:tag-creation:gate:check -- --gate <path>` 本地只读 tag creation execution gate，要求 package build gate green、tag request、tag policy review、source commit evidence、release-note linkage、ordered command evidence、rollback/monitoring/credential boundary 完整，并保持 gate-only：不运行 `git tag`、不 push tag、不创建 release、不上传、不部署、不使用凭证、不宣称 production ready。
- Runtime UI Reframing、Delivery Demo Smoke Path、Browser Evidence、Runtime UI Delivery Polish 和 UI closeout。
- Runtime Console delivery handoff 摘要，可查看 recent runs、pending approvals、retryable failures、asset landings 和 governed trace candidates。

当前状态：

- 已达到 **local delivery demo ready**。
- 核心 controlled runtime 已成型，playbook lifecycle 已有第一层合同、本地 review diagnostic、deprecated replacement 合同、proposal gate、migration plan gate、handoff checklist、delivery candidate gate、production release policy gate、production release approval packet gate、release execution planning gate、package build execution gate 和 tag creation execution gate，但原始“固定 agent 执行步骤、让结果可控”的全部设计目标尚未完全生产化闭环。
- 尚未宣称 production ready。
- 当前 controlled-runtime 里程碑已经具备本地收尾门禁。
- 下一阶段继续 **Artifact Upload Execution Gate Design**，从已建立的 tag creation gate 边界补齐 artifact upload、deployment 和 external-write execution gates、部署验证、统一 policy、真实 replay、authoring UI 和生产运维准备。

仍未完成：

- Fixture replay 目前仍是 metadata-only 合约校验。
- 真实 LLM / tool replay 还没有实现。
- real replay 的 sandbox、credential isolation、approval simulation、store isolation、side-effect blocking 和 replay result ownership 已在 `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md` 文档化。
- replay sandbox contract types 已在 `src/lib/executor/runtime/replay-sandbox-contracts.ts` 文档化为 TypeScript contract 和纯 validator。
- no-side-effect replay sandbox prototype 已在 `src/lib/executor/runtime/replay-sandbox.ts` 实现为 contract -> replay result artifact 的纯函数。
- governed fixture -> replay sandbox contract bridge 已在 `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts` 实现为 fixture metadata -> contract 的纯 helper。
- catalog-level replay sandbox report 已在 `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts` 实现为 explicit catalog -> contract -> artifact 的纯报告 helper。
- replay sandbox catalog CI summary 已通过 `npm run replay:sandbox:fixtures` 实现为 compact JSON 命令。
- replay sandbox failure diagnostics taxonomy 已把 contract bridge failure、sandbox artifact failure 和 guarantee violation 固定为稳定 `failureKind` / `guaranteeErrors` 输出。
- replay sandbox failure harness direct modes 已覆盖 contract、sandbox 和 guarantee failures。
- Runtime UI Reframing、Runtime Console Delivery Readiness Audit、Delivery Demo Smoke Path、Browser Evidence And Release Readiness Sweep、Post-Delivery Fixture / Playbook Expansion Review、Trace Operations maintenance slices、Control Chain closeout gate、本地 mutation executor 边界、post-apply sequence gate、post-apply evidence gate、fixture refresh handoff gate、candidate fixture review gate、fixture replacement handoff gate、post-replacement evidence gate、release handoff review gate、handoff summary gate、delivery candidate gate、production release policy gate、production release approval packet gate、release execution planning gate、package build execution gate 与 tag creation execution gate 已完成；因此下一阶段应继续 artifact upload execution gate design，仍不能直接刷新 fixture、跑真实工具 replay、扩大外部写回范围、打包上传、部署或宣称生产就绪。

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
- No-Side-Effect Replay Sandbox Prototype Design：`docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
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

- 已在 `src/lib/executor/runtime/replay-sandbox-contracts.ts` 新增 TypeScript-only replay contract types。
- Contract types 覆盖 replay input、sandbox context、credential policy、approval simulation、store isolation、side-effect policy 和 replay result artifact。
- 该阶段仍不允许 LLM replay、不允许 tool execution、不允许 route calls、不允许 store 读写、不允许资产写回。

### P2. No-Side-Effect Replay Sandbox Prototype Design

目标：

- 已在 `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md` 设计最小 no-side-effect sandbox prototype。
- Prototype design 必须以 validated replay sandbox contract 为唯一入口。
- Prototype design 的唯一输出应是 replay result artifact。

### P3. No-Side-Effect Replay Sandbox Prototype Implementation

目标：

- 已新增 `src/lib/executor/runtime/replay-sandbox.ts`。
- `runNoSideEffectReplaySandbox()` 先执行 `validateReplaySandboxContract()`。
- unsafe contract 返回 failed replay result artifact，cursor 只到 `preflight`。
- safe contract 返回 replay-local result artifact，不接 executor、route、Runtime Console 或 store。
- Prototype 不调用生产凭据、不写 store、不写资产、不绕过 approval simulation。

### P4. Governed Fixture To Replay Sandbox Contract Bridge

目标：

- 已新增 `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`。
- `buildReplaySandboxContractFromFixture()` 把 committed governed fixture metadata 转成 `ReplaySandboxContract`。
- 只读取 fixture metadata，不恢复 raw governed artifact payload。
- 继续拒绝 broken provenance、redaction boundary failure、live credentials、production stores、business asset writes 和 raw controlled run input。
- 输出只能进入 no-side-effect replay sandbox prototype。

### P5. Catalog-Level Replay Sandbox Report

目标：

- 已新增 `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`。
- `buildReplaySandboxCatalogReport()` 把 committed fixture catalog 跑过 `fixture -> contract -> replay artifact`。
- 汇总 fixture id、playbook id、contract build result、sandbox artifact status、diagnostics 和 no-side-effect guarantees。
- 仍不执行真实工具、不调用 route、不读写 runtime store、不改 fixture JSON、不写资产。

### P6. Replay Sandbox Catalog CI Summary

目标：

- 已新增 `npm run replay:sandbox:fixtures`。
- 命令读取 `buildReplaySandboxCatalogReport()` 的结果并输出 compact JSON。
- 当 report 不通过时以非零退出；test-only failure harness 已覆盖 failed JSON 和 exit 1。
- 保持 no route、no store、no tool execution、no business asset write 边界。

### P7. Replay Sandbox Failure Diagnostics Hardening

目标：

- 已新增 reusable synthetic sandbox / contract failure coverage。
- 已固定 CLI failed output 的 diagnostics shape。
- 已区分 contract bridge failure、sandbox artifact failure 和 guarantee failure。
- 不把 failing fixture JSON 加入 committed governed fixture catalog。

### P8. Replay Sandbox Failure Harness Expansion

目标：

- 已为 replay sandbox failure harness 增加 direct modes：contract、sandbox、guarantee。
- 已证明每类失败都输出 parseable compact JSON 并以非零退出。
- committed `replay:sandbox:fixtures` 继续保持全绿。
- 不新增 failing committed fixture JSON，不进入真实工具 replay。

### P9. Governed Fixture / Playbook Expansion Review

目标：

- 审查当前 sales/support governed fixtures 是否足够。
- 判断下一步应该新增 fixture coverage、迁移新 controlled playbook，还是先强化 operational retention / maintenance。
- 输出下一阶段 spec 范围，不能直接创建新 fixture JSON 或新 playbook。

### P10. Runtime UI Reframing

目标：

- 已新增 runtime cockpit summary model。
- 首页第一视口已从 app/chat desk 转向 controlled playbook cockpit。
- Runtime Console 已成为首页主检查动作。
- 不改变业务 app window、workflow launch 或后端 replay 行为。

### P11. Runtime Console Delivery Readiness Audit

目标：

- 已审查 Runtime Console 是否足够作为当前分支的交付主界面。
- 已检查 approval、retry/resume、governed trace copy、asset landing、fixture/replay gate 的清晰度。
- 已输出交付阻塞清单：先固定 demo smoke path，再补浏览器证据。

### P12. Delivery Demo Smoke Path

目标：

- 已通过本地 seed/check 固定 completed、awaiting approval、retryable failed 三类 demo run。
- 已固定 sales / knowledge / workflow / draft / support 资产记录。
- 已验证 governed trace artifact 脱敏边界。
- 保持本地脚本边界，不暴露公开 seed API，不绕过 approval、writeback 或 trace governance。

### P13. Browser Evidence And Release Readiness Sweep

目标：

- 已在真实浏览器验证 Home cockpit -> Runtime Console -> `delivery-demo` -> asset landing -> governed trace copy。
- 已用 Playwright 保存可复查截图和 snapshot 证据。
- 已确认浏览器 console 没有 error；只保留 dev/preload warnings。
- 没有在本阶段新增真实 replay 或新 playbook。

### P14. Governed Fixture / Playbook Expansion Review

目标：

- 已复核当前 registered playbooks 与 committed governed fixtures 一一覆盖。
- 已确认 delivery demo seed data 不是新增 committed fixture 的来源。
- 已确认当前不新增 fixture JSON，不迁移新 controlled playbook。

### P15. Governed Fixture / Playbook Expansion

目标：

- 只有当 sales/support fixture gate 稳定后，才扩展新 fixture 或新 playbook。
- 新 fixture 必须通过 redaction、approval、writeback metadata、stable identity 和 catalog coverage 审查。
- 新 playbook 必须先进入 spec / plan / TDD / fixture replay 边界，而不是直接接真实工具。

### P16. Operational Retention And Maintenance Hardening

目标：

- 将 governed trace operational runbook 转成更稳定的维护节奏。
- 继续收紧 raw trace retention、fixture refresh stop condition、summary/harness drift 处理。
- 保持 `trace:fixtures` 作为机器可读自动化合同，`trace:fixtures:summary` 作为人读 triage。

### P17. Runtime-Serving UI / App Polish

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

# 可控 Agent Runtime 开发手册

Last updated: 2026-07-07

## 1. 项目新定位

AgentCore OS 后续不再优先朝“完整 AI OS 大壳”扩展，也不再投入做一个普通 skill。

项目级总纲见：

- [AgentCore OS 项目框架总纲](PROJECT_FRAMEWORK.zh-CN.md)

新的核心方向是：

**把 AgentCore OS 收缩成一个可控 Skill / Playbook Runtime：读取固定工作流，按确定步骤执行，限制工具边界，保留人工审批，记录 trace，并把结果写回资产层。**

换句话说：

- 成熟 skill 已经解决“操作手册怎么写”。
- AgentCore OS 要解决“系统如何可靠执行这些操作手册”。

这也是项目继续存在的独特价值。

## 2. 核心原则

### 2.1 Runtime 优先，而不是壳优先

不要继续为了“OS 感”增加窗口、应用、导航和装饰性控制台。

后续所有开发都必须回答一个问题：

**这项改动是否让固定流程更可控、更可审计、更可恢复？**

如果答案是否定的，默认不做。

Runtime UI 的优化也遵守同一条规则。当前阶段只优化 Home / Runtime Console 的交付可读性、审批可见性、恢复状态和 governed trace / asset landing 表达；不做全量换皮，不重启桌面壳方向。

### 2.2 Playbook 是权威步骤来源

LLM 可以生成建议、草稿和结构化内容，但不能成为默认流程主控。

正式执行时，步骤来源必须是系统验证过的 playbook / scenario / workflow spec。

禁止让模型在运行时自由决定：

- 执行多少步
- 调用哪些工具
- 跳过哪个审批点
- 把结果写到哪里
- 是否结束工作流

### 2.3 Skill 是执行节点，不是 prompt 注释

项目里的 skill 不应只是“把一段提示词塞进 system prompt”。

一个可执行 skill 至少要声明：

- 输入 schema
- 输出 schema
- 可用工具
- 禁止工具
- 是否需要人工审批
- 成功条件
- 失败处理
- trace 字段
- 资产写回目标

### 2.4 人工审批是状态机节点

`review` 和 `manual` 不是 UI 标签，而是执行阻断点。

进入审批点时，runtime 必须：

- 暂停后续自动执行
- 记录 pending approval
- 展示待确认内容、风险和影响
- 等待用户批准、拒绝或修改
- 把决策写入 trace

### 2.5 Trace 是产品能力

可控 agent 的信任来自复盘能力。

每次执行都必须能回答：

- 谁触发了这次执行
- 执行的是哪个 playbook
- 当前跑到哪一步
- 每一步用了什么输入
- 调用了什么工具
- 哪一步需要人工审批
- 哪一步失败
- 是否重试或降级
- 最终结果写到了哪里

## 3. 明确非目标

短期不做：

- 新增更多独立 App
- 继续强化桌面 OS 视觉表达
- 做通用聊天 agent
- 做新的普通 skill 集合
- 做开放式多 agent 市场
- 做复杂插件生态
- 做大而全企业 SaaS 管理后台

这些方向不是永远不能做，而是在可控 runtime 没跑通前都不是主线。

## 4. 当前代码资产判断

当前项目已有可以复用的骨架：

- `src/lib/workspace-presets.ts`
  - scenario、trigger、workflow stage 的初始定义。
- `src/lib/workflow-runs.ts`
  - workflow run 和 stage state。
- `src/lib/executor/contracts.ts`
  - 统一执行请求、执行策略、multi-step policy、trace 类型。
- `src/lib/executor/step-executor.ts`
  - 多步骤执行、依赖检查、审批 gate、工具调用、失败中止。
- `src/lib/executor/tools/*`
  - 工具注册表、LLM、文件、代码执行、人机交互等工具雏形。
- `src/lib/executor/skills/*`
  - skill catalog / planner / runtime 雏形。
- `docs/EXECUTOR_CONVERGENCE.zh-CN.md`
  - 单一执行契约、系统自有 session、skill runtime 的方向说明。

当前最大问题：

**固定 playbook runtime 已经成为主线，但设计目标还没有完全闭环。**

当前已完成固定 playbook、validator、approval、durable trace、resume/retry、approved writeback、governed fixture replay、Runtime Console、本地交付门禁、第一层 playbook lifecycle contract、本地 lifecycle review diagnostic、deprecated replacement contract 和 lifecycle handoff checklist。后续第一优先级不再是证明方向，而是继续硬化控制链路：统一审计 playbook 合同、补强 policy/guardrail、提升 replay depth、把 lifecycle contract 扩展成完整 authoring/versioning/deprecation flow，并完善生产运维边界。

## 5. 目标架构

### 5.1 分层

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
```

### 5.2 Playbook Resolver

职责：

- 根据 trigger、scenarioId、role、industry 选择 playbook。
- 把 playbook 转换为内部 `ExecutionPlan`。
- 不调用模型做默认规划。

第一阶段可以从 `workspaceScenarios.workflowStages` 转换，但要逐步升级为更强的 playbook schema。

### 5.3 Plan Validator

职责：

- 校验 step id 是否属于当前 playbook。
- 校验工具是否在 allowlist。
- 校验 `review/manual` 节点是否保留审批。
- 校验输入输出 schema 是否完整。
- 禁止用户请求覆盖系统步骤。

如果验证失败，runtime 应拒绝执行，而不是让模型“修一修”继续跑。

当前新增的本地只读控制链路审计命令是：

```bash
npm run playbook:control:audit
```

该命令会检查 registered controlled playbooks 的 lifecycle metadata、catalog 唯一性、step schema、tool boundary、approval gate、failure policy、writeback/result asset alignment、default runtime guardrails 和 governed fixture coverage。它只做审计，不执行工具、不写 store、不写资产、不刷新 fixture、不发布 release、不宣称 production ready。

每条 registered playbook 必须声明：

- `lifecycle.status`：`active`、`experimental` 或 `deprecated`；
- `lifecycle.owner`：维护责任人或团队；
- `lifecycle.lastReviewedAt`：`YYYY-MM-DD`；
- `lifecycle.reviewCadenceDays`：正整数；
- `lifecycle.changePolicy`：当前固定为 `spec_plan_tdd_fixture_required`。

当 `lifecycle.status === "deprecated"` 时，还必须声明：

- `lifecycle.deprecatedAt`：`YYYY-MM-DD`；
- `lifecycle.deprecationReason`：非空废弃原因；
- `lifecycle.replacementPlaybookId`：已注册的替代 playbook id，不能指向自身。

这只是 lifecycle / deprecation contract 的合同层，不等于已经完成 playbook authoring UI、版本迁移、自动迁移器、废弃流程或发布审批。

当前新增的 lifecycle 维护诊断命令是：

```bash
npm run playbook:lifecycle:review
```

该命令只读检查 `active` playbook 的 `lastReviewedAt + reviewCadenceDays`，输出 `nextReviewDueAt`、`daysUntilReviewDue` 和到期 findings。到期或过期时退出非零；正常时保持 `productionReady: false`、`publishingPerformed: false` 和 `diagnosticOnly: true`。可用 `--now YYYY-MM-DD` 做确定性维护检查。

这仍然不是 authoring UI、版本迁移、废弃流程或发布审批；它只是把 lifecycle metadata 转成可执行的本地维护信号。

当前新增的 version / deprecation handoff checklist 命令是：

```bash
npm run playbook:lifecycle:handoff
```

该命令本地只读聚合 `playbook:control:audit` 与 `playbook:lifecycle:review` 的判断，输出 `readyForLifecycleHandoff`、control audit / lifecycle review check status、active / experimental / deprecated playbook 数量，以及已声明的 deprecated replacement chains。它支持 `--now YYYY-MM-DD` 和 `--compact`，并保持 `productionReady: false`、`publishingPerformed: false`、`handoffOnly: true`。

这仍然不是 authoring UI、版本迁移器、自动 deprecation flow、fixture refresh、发布审批或生产门禁；它只是把现有合同门聚合成维护者在 playbook version/deprecation handoff 前必须先看的本地检查清单。

当前新增的 lifecycle change proposal gate 是：

```bash
npm run playbook:lifecycle:change:check -- --proposal <path>
```

该命令读取本地 JSON proposal，检查 `proposalId`、`changeType`、`playbookId`、`owner`、`reason`、`specPath`、`planPath`、`requiredCommands`、`expectedFixtureIds` 和 deprecation metadata。它要求 proposal 声明 `playbook:control:audit`、`playbook:lifecycle:handoff`、`trace:fixtures --silent` 和 `test:controlled-runtime`，并确认 spec/plan 文件存在。它保持 `productionReady: false`、`publishingPerformed: false`、`proposalOnly: true`。

这仍然不批准 playbook 变更，也不修改 registered playbooks、fixtures、stores、release evidence 或外部系统；它只是把 authoring/versioning/deprecation 的入口从口头约定变成结构化、本地可审计的 proposal contract。

当前新增的 lifecycle migration plan gate 是：

```bash
npm run playbook:lifecycle:migration:plan:check -- --plan <path>
```

该命令读取本地 JSON migration plan，并读取其引用的 proposal JSON。它会先复用 proposal checker 语义确认 proposal green，再检查 `planId`、`proposalPath`、`migrationType`、`fromPlaybookId`、`toPlaybookId`、`plannedChanges`、`rollbackPlan`、`fixtureReview`、`requiredCommands` 和 `mutationPolicy`。`mutationPolicy` 必须是 `no_mutation_until_plan_approved`。它保持 `productionReady: false`、`publishingPerformed: false`、`planOnly: true`。

这仍然不批准、不执行、不应用迁移；它只是把 proposal 之后、真实 playbook / fixture 变更之前的迁移规划变成结构化、本地可审计的合同。

当前新增的 lifecycle maintenance sequence gate 是：

```bash
npm run playbook:lifecycle:sequence:check -- --sequence <path>
```

该命令读取本地 JSON sequence，并读取其引用的 proposal JSON 与 migration plan JSON。它会复用 proposal checker 和 migration plan checker 语义，确认 proposal / plan green、`proposalPath` 与 `migrationPlanPath` 对齐，并检查 `orderedCommands` 是否严格按以下顺序声明：`playbook:lifecycle:change:check`、`playbook:lifecycle:migration:plan:check`、`playbook:lifecycle:handoff`、`trace:fixtures --silent`、`test:controlled-runtime`。它还要求 `handoffExpectation`、`fixtureExpectation`、`runtimeTestExpectation`、`mutationPolicy` 和 `publishingPolicy` 保持明确边界。它保持 `productionReady: false`、`publishingPerformed: false`、`sequenceOnly: true`。

这仍然不执行命令、不批准、不执行、不应用迁移；它只是把 proposal / migration plan / handoff / fixture / runtime regression 的维护顺序变成结构化、本地可审计的 sequence contract。

当前新增的 lifecycle sequence evidence gate 是：

```bash
npm run playbook:lifecycle:sequence:evidence:check -- --evidence <path>
```

该命令读取本地 JSON evidence，并读取其引用的 sequence / proposal / migration plan JSON。它会复用 proposal checker、migration plan checker 和 sequence checker 语义，确认被引用 sequence green，再检查 `commandResults` 是否按 sequence 声明顺序记录 proposal check、migration plan check、lifecycle handoff、`trace:fixtures --silent` 和 `test:controlled-runtime`。它还会检查 sequence/handoff 的非生产边界、fixture green evidence、controlled-runtime 测试数量，以及 `mutationSummary.performed: false`、`publishingSummary.performed: false`、`approvalStatus: "evidence_only"`。它保持 `productionReady: false`、`publishingPerformed: false`、`evidenceOnly: true`。

这仍然不执行命令、不生成 evidence、不批准、不执行、不应用迁移；它只是把已记录的 lifecycle maintenance evidence 变成结构化、本地可审计的合同。

当前新增的 lifecycle sequence evidence freshness gate 是：

```bash
npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence <path>
```

该命令读取本地 JSON evidence，并复用 sequence evidence checker。它会计算被引用 sequence 文件的 SHA-256 digest，读取当前 git commit，检查 evidence 的 `provenance.sourceCommit` / `sourceCommitFull`、`provenance.sequenceDigest` 和 `provenance.maxAgeHours`，并拒绝晚于审计时间 `now` 的 `recordedAt`。它支持 `--now <iso-date>` 和 `--current-commit <commit>`，用于固定示例和审计复现。它保持 `productionReady: false`、`publishingPerformed: false`、`freshnessOnly: true`。

这仍然不执行命令、不生成 evidence、不批准、不执行、不应用迁移；它只是防止 stale evidence 或不匹配的 sequence digest 被用于 playbook lifecycle 维护判断。

当前新增的 lifecycle sequence evidence doctor 是：

```bash
npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence <path>
```

该命令复用 freshness checker 作为唯一校验来源，并把结果归类为 `fresh_evidence`、`missing_evidence`、`invalid_evidence`、`invalid_provenance`、`sequence_digest_mismatch`、`source_commit_mismatch`、`future_recorded_at`、`stale_evidence` 或 `invalid_recorded_at`。输出包含 `nextCommand` 与 `nextAction`，但不会执行建议命令。它保持 `productionReady: false`、`publishingPerformed: false`、`diagnosticOnly: true`。

这仍然不执行命令、不生成 evidence、不批准、不执行、不应用迁移；它只是把 freshness/provenance findings 变成维护者可直接处理的诊断状态。

当前新增的 lifecycle maintenance readiness gate 是：

```bash
npm run playbook:lifecycle:maintenance:ready -- --evidence <path>
```

该命令聚合 `npm run playbook:lifecycle:handoff` 与 `npm run playbook:lifecycle:sequence:evidence:doctor`。只有 handoff green 且 sequence evidence doctor 状态为 `fresh_evidence` 时，才会输出 `readyForLifecycleMaintenance: true`。它支持 `--now <iso-or-date>` 和 `--current-commit <commit>`，其中 handoff 使用日期部分，evidence doctor 使用完整时间。它保持 `productionReady: false`、`publishingPerformed: false`、`readinessOnly: true`。

这仍然不执行建议命令、不生成 evidence、不批准、不执行、不应用迁移；它只是把 catalog handoff 与 evidence readiness 合并成一个本地维护准入判断。

当前新增的 lifecycle mutation approval receipt gate 是：

```bash
npm run playbook:lifecycle:mutation:approval:check -- --approval <path>
```

该命令读取本地 approval JSON，并用其中的 `evidencePath` 重新运行 `playbook:lifecycle:maintenance:ready` helper。只有当前 readiness green、approval receipt 的 `decision` 为 `approved`、`approvalScope` 为 `playbook_lifecycle_mutation`，且内嵌 readiness summary 与 mutation boundary 都保持非生产边界时，才会输出 `approvedForLifecycleMutation: true`。它支持 `--now <iso-or-date>` 和 `--current-commit <commit>`，保持 `productionReady: false`、`publishingPerformed: false`、`approvalOnly: true`。

这仍然不执行迁移、不修改 registered playbooks、不刷新 fixtures、不写 store、不调用外部 connector、不发布；它只是把 readiness green 之后的人类批准变成结构化、本地可审计的 approval receipt。

当前新增的 lifecycle mutation dry-run gate 是：

```bash
npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>
```

该命令读取本地 dry-run JSON，并重新运行其引用的 mutation approval checker 与 migration plan checker。只有 approval green、migration plan green、`targetPlaybookId` 与 migration plan 目标一致、planned target 路径限制在 `src/lib/executor/playbooks/`、fixture impact 覆盖 migration plan 的 expected fixture ids，且 `executionBoundary` 保持 `dryRunOnly: true`、未执行 mutation、未刷新 fixture、未写 store、未外部写入、未发布、未生产就绪时，才会输出 `readyForLifecycleMutationDryRun: true`。它支持 `--now <iso-or-date>` 和 `--current-commit <commit>`，保持 `productionReady: false`、`publishingPerformed: false`、`dryRunOnly: true`。

这仍然不执行迁移、不修改 registered playbooks、不刷新 fixtures、不写 store、不调用外部 connector、不发布；它只是把批准后的拟变更目标和副作用边界变成结构化、本地可审计的 dry-run contract。

当前新增的 project closeout readiness gate 是：

```bash
npm run project:closeout:check -- --evidence <path> --dry-run <path>
```

该命令聚合 `playbook:control:audit`、`playbook:lifecycle:maintenance:ready`、`playbook:lifecycle:mutation:dry-run:check` 和 `delivery:ready:check`。只有 playbook 合同审计、维护准入、mutation dry-run 与本地 delivery readiness 全部 green，且没有任何子门禁宣称 production readiness 或 publishing，才会输出 `readyForCurrentMilestoneCloseout: true`。它支持 `--now <iso-or-date>`、`--current-commit <commit>` 和 `--compact`，保持 `productionReady: false`、`publishingPerformed: false`、`closeoutOnly: true`。

该门禁会把当前 controlled-runtime 里程碑中已经闭合的部分写成 machine-readable JSON，同时把 `real_mutation_executor`、`authoring_versioning_deprecation_ui`、`unified_policy_guardrail_layer`、`deeper_real_replay`、`external_connector_writeback` 和 `production_operations` 明确标记为 `deferred_next_phase`。它不执行迁移、不修改 registered playbooks、不刷新 fixtures、不写 store、不调用外部 connector、不发布、不打 tag、不上传 artifact、不宣称 production ready。

当前新增的 lifecycle mutation preflight gate 是：

```bash
npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>
```

该命令是 Productionization Preparation 的第一步，会重新运行 `project:closeout:check` 与 `playbook:lifecycle:mutation:dry-run:check` helper，并读取 dry-run JSON 的 planned targets。只有 closeout green、dry-run green、approval green、至少一个 `registered_playbook_contract` target 使用 `operation: "update_contract"`、所有 target path 都限制在 `src/lib/executor/playbooks/`，且 dry-run execution boundary 仍然保持 no mutation / no fixture refresh / no store writes / no external writes / no publishing / no production readiness，才会输出 `readyForLifecycleMutationPreflight: true`。

这仍然不执行迁移、不修改 registered playbooks、不刷新 fixtures、不写 store、不调用外部 connector、不发布；它只是把真实 mutation executor 前的人工实现审查条件变成结构化、本地可审计的 preflight gate。

当前新增的 lifecycle mutation executor boundary 是：

```bash
npm run playbook:lifecycle:mutation:executor:preview -- --manifest <path> --evidence <path> --dry-run <path>
npm run playbook:lifecycle:mutation:executor:apply -- --manifest <path> --evidence <path> --dry-run <path> --confirm-apply
```

preview 会读取 manifest，重新跑 preflight，并校验：

- manifest embedded preflight 与 fresh preflight 都为 green；
- `dryRunPath` 与 CLI 输入一致；
- target 只能位于 `src/lib/executor/playbooks/`，且必须出现在 dry-run `plannedTargets` 的 `update_contract` target set 中；
- operation 当前只能是 `replace_file`；
- 当前文件 SHA-256 必须等于 `expectedCurrentSha256`；
- `nextContent` SHA-256 必须等于 `nextContentSha256`；
- execution boundary 必须保持 executor-only，且不刷新 fixture、不写 store、不外部写入、不发布、不宣称 production ready。

apply 只有在 `--confirm-apply` 明确存在时才会写入，并且只写 manifest 中通过校验的本地 registered playbook 文件。它仍然不是 fixture refresh、runtime replay、store write、external connector write、release publishing 或 production operation。apply 之后必须重新运行 control audit、governed fixture / replay gates 和后续 release/handoff gates，不能直接宣称交付或生产可用。

当前新增的 lifecycle mutation post-apply sequence gate 是：

```bash
npm run playbook:lifecycle:mutation:post-apply:sequence:check -- --sequence <path>
```

该命令读取本地 sequence JSON 和其引用的 apply report。只有 apply report 明确来自 `playbook:lifecycle:mutation:executor` 的 `apply` 模式，状态为 `mutation_apply_complete`，已确认执行本地 mutation，且仍保持不刷新 fixture、不写 store、不外部写入、不发布、不宣称 production ready 时，sequence 才能继续通过。sequence 必须严格声明后续命令顺序：`npm run playbook:control:audit`、`npm run playbook:lifecycle:handoff`、`npm run trace:fixtures --silent`、`npm run trace:fixtures:summary --silent`、`npm run test:controlled-runtime`、`npm run test:core-workflows`、`git diff --check`。

它保持 `productionReady: false`、`publishingPerformed: false`、`sequenceOnly: true`。它不执行这些命令、不生成 post-apply evidence、不刷新 fixture、不写 store、不调用外部 connector、不发布 release；它只是把 apply 之后到 fixture refresh / release handoff 之前的审计顺序变成结构化、本地可审计的 sequence contract。

当前新增的 lifecycle mutation post-apply evidence gate 是：

```bash
npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence <path>
```

该命令读取本地 evidence JSON、其引用的 post-apply sequence JSON 和 sequence 引用的 apply report JSON。它会先复用 post-apply sequence checker，只有 sequence green 后才继续验证已记录的 command results。evidence 必须严格按 sequence 顺序记录 `playbook:control:audit`、`playbook:lifecycle:handoff`、`trace:fixtures --silent`、`trace:fixtures:summary --silent`、`test:controlled-runtime`、`test:core-workflows` 和 `git diff --check`，每条命令都必须 `ok: true`、`exitCode: 0` 且有 `recordedAt`。

它还要求 control audit / handoff / fixture / fixture summary / controlled-runtime / core-workflows / diff check 的专用 metadata 都存在，并要求 `postApplyAuditBoundary` 保持未刷新 fixture、未写 store、未外部写入、未发布、未宣称 production ready。它保持 `productionReady: false`、`publishingPerformed: false`、`evidenceOnly: true`。它不执行命令、不刷新 fixture、不写 store、不调用外部 connector、不发布 release；它只是把 apply 后的审计执行证据变成结构化、本地可审计的 evidence contract。

当前新增的 lifecycle mutation fixture refresh handoff gate 是：

```bash
npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff <path>
```

该命令读取本地 handoff JSON、其引用的 post-apply evidence JSON、post-apply sequence JSON 和 apply report JSON。它会复用 post-apply sequence / evidence checker，只有 evidence green、`readyForFixtureRefreshHandoff: true`、`evidenceOnly: true` 且没有 production / publishing claim 时才继续验证 handoff。handoff 必须声明目标 playbook、至少一个目标 governed fixture id、完整人工 review checklist、rollback notes，并要求 `handoffBoundary` 保持 `handoffOnly: true`、未生成 candidate fixture、未替换 committed fixture、未刷新 fixture、未写 store、未外部写入、未发布、未宣称 production ready。

它保持 `productionReady: false`、`publishingPerformed: false`、`handoffOnly: true`。它不生成候选 fixture、不替换 committed fixture、不执行 builder、不刷新 fixture、不写 store、不调用外部 connector、不发布 release；它只是把 green post-apply evidence 之后能否进入人工 fixture refresh review 变成结构化、本地可审计的 handoff contract，并由后续 candidate fixture review gate 承接候选文件审查。

当前新增的 lifecycle mutation candidate fixture review gate 是：

```bash
npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review <path>
```

该命令读取本地 review JSON、其引用的 fixture refresh handoff JSON、handoff 引用的 post-apply evidence / sequence / apply report JSON，以及 review 指向的 candidate fixture JSON 和 committed fixture JSON。它会复用 fixture refresh handoff checker，并用 `validateControlledTraceFixture()` 与 `replayControlledTraceFixture()` 对 candidate fixture 做只读 schema/replay 校验。review 必须声明 `catalogFixtureId`，且该 id 必须在 handoff 的 `intendedFixtureIds` 中；candidate fixture 的 `playbookId` 必须与 handoff target playbook 对齐；敏感标记扫描必须无命中；人工 review evidence 必须覆盖 source identity、redaction、playbook contract、approval terminal state、writeback identity、failure triage、sensitive string search、replacement diff、catalog gate、runtime regression 和 rollback notes。

它保持 `productionReady: false`、`publishingPerformed: false`、`reviewOnly: true`。它不生成候选 fixture、不替换 committed fixture、不改 catalog、不运行 catalog/test/lint/build 命令、不写 store、不调用外部 connector、不发布 release；它只是把已经存在的候选 fixture 是否可以进入人工 committed fixture replacement review 变成结构化、本地可审计的 review contract。

当前新增的 lifecycle mutation fixture replacement handoff gate 是：

```bash
npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff <path>
```

该命令读取本地 handoff JSON 和其引用的 candidate fixture review JSON，并复用 candidate fixture review checker。handoff 必须声明 `catalogFixtureId`、`targetPlaybookId`、`candidateFixturePath` 和 `committedFixturePath`，且这些字段必须与 candidate review 对齐；`committedFixturePath` 必须限定在 `src/__tests__/fixtures/controlled-traces/` 下；rollback evidence 必须覆盖 prior committed fixture review、replacement diff review plan、scoped restore path、documented restore plan 和 rollback notes；post-replacement validation plan 必须覆盖 governed fixture catalog、fixture summary、controlled-runtime、core-workflows、`git diff --check` 和后续 evidence gate。

它保持 `productionReady: false`、`publishingPerformed: false`、`handoffOnly: true`。它不替换 committed fixture、不生成候选 fixture、不刷新 fixture、不运行 catalog/test/lint/build 命令、不写 store、不调用外部 connector、不发布 release；它只是把 candidate review 之后是否可以进入人工 committed fixture replacement 变成结构化、本地可审计的 handoff contract。下一步可以在人工替换后定义 post-replacement evidence gate。

当前新增的 lifecycle mutation post-replacement fixture evidence gate 是：

```bash
npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence <path>
```

该命令读取本地 evidence JSON 和其引用的 fixture replacement handoff JSON，并复用 fixture replacement handoff checker。evidence 必须声明 replacement summary，且 `catalogFixtureId`、`targetPlaybookId`、`candidateFixturePath` 和 `committedFixturePath` 必须与 handoff 对齐；它还必须记录人工 committed fixture replacement 已发生、git diff review 已完成、rollback 仍可用。`commandResults` 必须严格按 handoff check、`trace:fixtures --silent`、`trace:fixtures:summary --silent`、`test:controlled-runtime`、`test:core-workflows`、`git diff --check` 的顺序记录，并且每条命令都要 `ok: true`、`exitCode: 0` 和非空 `recordedAt`。

它保持 `productionReady: false`、`publishingPerformed: false`、`evidenceOnly: true`。它不替换 committed fixture、不生成候选 fixture、不刷新 fixture、不运行 catalog/test/lint/build 命令、不写 store、不调用外部 connector、不发布 release；它只是把人工替换后的 fixture/runtime/core/diff evidence 变成结构化、本地可审计的证据门。后续 release handoff review gate 会在此基础上复核本地交付证据，但仍不能宣称 production ready。

当前新增的 lifecycle mutation release handoff review gate 是：

```bash
npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review <path>
```

该命令读取本地 review JSON 和其引用的 post-replacement evidence JSON，并复用 post-replacement evidence checker。review 必须声明 reviewer acceptance、rollback notes 和 next boundary；`commandResults` 必须严格按 post-replacement evidence check、`release:handoff:check`、`release:handoff:snapshot`、`release:handoff:evidence:status`、`release:handoff:evidence:audit`、`git diff --check` 的顺序记录，并且每条命令都要 `ok: true`、`exitCode: 0` 和非空 `recordedAt`。

它保持 `productionReady: false`、`publishingPerformed: false`、`reviewOnly: true`。它不运行 release 命令、不生成 snapshot、不写 store、不调用外部 connector、不发布 release、不打 tag、不打包、不上传 artifact、不宣称 production ready；它只是把 post-replacement evidence 与本地 release handoff evidence/status/audit 复核结果变成结构化、本地可审计的 review gate。后续 handoff summary gate 会在此基础上生成维护者摘要，但仍不能宣称 production ready。

当前新增的 lifecycle mutation handoff summary gate 是：

```bash
npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary <path>
```

该命令读取本地 summary JSON 和其引用的 release handoff review JSON，并复用 release handoff review checker。summary 必须声明目标 playbook、lifecycle mutation status、evidence chain status、local release claim、maintainer decision 和 next boundary；`commandSummary` 必须严格按 release handoff review、`test:controlled-runtime`、`test:core-workflows`、`lint`、`build`、`git diff --check` 的顺序记录，并且每条命令都要 `ok: true`、`exitCode: 0` 和非空 `recordedAt`。

它保持 `productionReady: false`、`publishingPerformed: false`、`summaryOnly: true`。它不运行命令、不生成 snapshot、不写 store、不调用外部 connector、不发布 release、不打 tag、不打包、不上传 artifact、不宣称 production ready；它只是把 release handoff review 之后的维护者摘要、风险/deferred items 和 rollback notes 变成结构化、本地可审计的 handoff summary。后续 delivery candidate gate 会在此基础上汇总本地交付候选证据，但仍不能宣称 production ready。

当前新增的 delivery candidate gate 是：

```bash
npm run delivery:candidate:check -- --candidate <path>
```

该命令读取本地 candidate JSON，复用 handoff summary checker 和 delivery readiness checker。candidate 必须声明 local delivery candidate claim、source handoff claim、目标里程碑和 next boundary；`commandEvidence` 必须严格按 handoff summary、`delivery:ready:check`、`test:controlled-runtime`、`test:core-workflows`、`lint`、`build`、`git diff --check` 的顺序记录，并且每条命令都要 `ok: true`、`exitCode: 0` 和非空 `recordedAt`。

它保持 `productionReady: false`、`publishingPerformed: false`、`candidateOnly: true`。它不运行完整回归/lint/build/diff 命令、不生成 snapshot、不写 store、不调用外部 connector、不发布 release、不打 tag、不打包、不上传 artifact、不宣称 production ready；它只是把 handoff summary、delivery readiness、回归/build 证据、文档对齐、risk/deferred items 和 rollback notes 变成结构化、本地可审计的 local delivery candidate gate。后续由 production release policy gate 和 approval packet 继续承接，但仍不能直接发布。

当前新增的 production release policy gate 是：

```bash
npm run release:production-policy:check -- --policy <path>
```

该命令读取本地 policy JSON，复用 delivery candidate checker，并要求引用的 delivery candidate report 为 green、candidate-only、未发布、未生产就绪。policy 必须声明 `policyId`、`deliveryCandidatePath`、`owner`、`recordedAt`、`productionReleasePolicy`、`commandEvidence`、`policySections`、`riskSummary`、`rollbackSummary`、`deliveryCandidateResult`、`releaseBoundary` 和 `approvalStatus: "production_release_policy_review"`。

`commandEvidence` 必须严格按 `delivery:candidate:check`、`release:hygiene:check`、`test:controlled-runtime`、`test:core-workflows`、`lint`、`build`、`git diff --check` 的顺序记录，并且每条命令都要 `ok: true`、`exitCode: 0` 和非空 `recordedAt`。`policySections` 必须覆盖 packaging、tag creation、artifact upload、deployment、external writes、monitoring 和 rollback；发布动作类 section 必须 `approvalRequired: true`、`approved: false`、`executed: false`、`policyDocumented: true`。

它保持 `productionReady: false`、`publishingPerformed: false`、`policyOnly: true`。它不运行命令、不发布、不打 tag、不打包、不上传 artifact、不部署、不写 store、不调用外部 connector、不使用凭证、不宣称 production ready；它只是把 delivery candidate 之后的生产发布策略、风险、rollback 和非执行边界变成结构化、本地可审计的 policy review gate。下一步是 production release approval packet，但仍不能直接发布。

Runtime 默认 guardrails 现在由 `src/lib/executor/guardrails.ts` 导出，`step-executor.ts` 和 playbook control audit 共享同一个 `DEFAULT_GUARDRAILS`。后续修改默认步数上限、单步工具调用上限或高风险工具审批列表时，必须同时通过 `npm run playbook:control:audit` 和 `npm run test:controlled-runtime`。

### 5.4 Runtime State Machine

职责：

- 管理 workflow run 状态。
- 管理 stage 状态。
- 处理 start、advance、awaiting_human、complete、fail。
- 确保状态转换只发生在合法路径上。

现有 `workflow-runs.ts` 是基础，但后续需要和 executor trace 更紧密绑定。

### 5.5 Step Runner

职责：

- 接收已经验证过的 step。
- 按依赖顺序执行。
- 执行前检查审批、工具权限、时间预算、token 预算。
- 执行后校验输出 schema。
- 把 step result 写入 trace。

Step Runner 不负责重新发明步骤。

### 5.6 Tool Gateway

职责：

- 统一管理工具定义、参数 schema、权限边界。
- 执行前校验参数。
- 高风险工具必须进入审批。
- 所有工具结果必须进入 trace。

工具不能直接暴露给模型自由选择。

### 5.7 Approval Gate

职责：

- 管理 pending approvals。
- 展示待审批 step、输入、输出草稿、风险、写回目标。
- 记录 approve / reject / revise。
- 支持超时、恢复、重开。

当前 `approval-store.ts` 是内存态，只能作为原型。后续需要迁移到 durable runtime state。

### 5.8 Trace Store

职责：

- 保存执行计划、每步结果、工具调用、审批决策、失败信息。
- 支持按 workflowRunId、sessionId、requestId 查询。
- 对敏感信息脱敏。
- 支持失败复盘和回归测试。

### 5.9 Asset / Memory Writeback

职责：

- 把最终结果沉淀到业务资产。
- 区分 raw output、approved output、reusable pattern。
- 不把所有模型输出都自动变成长期记忆。
- 只有通过验收或人工确认的内容才能进入高信任资产层。

## 6. Playbook Schema 草案

第一阶段建议新增显式 playbook 类型，而不是继续把所有语义塞进 `workspaceStages.desc`。

```ts
type ControlledPlaybook = {
  id: string;
  title: string;
  scenarioId: string;
  version: string;
  triggerTypes: Array<"manual" | "schedule" | "inbound_message" | "web_form">;
  steps: ControlledPlaybookStep[];
  resultAssets: string[];
};

type ControlledPlaybookStep = {
  id: string;
  title: string;
  mode: "auto" | "assist" | "review" | "manual";
  purpose: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  allowedTools: string[];
  forbiddenTools?: string[];
  requiresApproval: boolean;
  acceptanceCriteria: string[];
  writesTo?: Array<{
    target: "workflow_run" | "draft" | "sales_asset" | "support_asset" | "knowledge_asset";
    when: "on_success" | "after_approval";
  }>;
  onFailure: {
    action: "retry" | "await_human" | "fail_run";
    maxRetries?: number;
  };
};
```

最小要求：

- 每个 step 必须有 `inputSchema` 和 `outputSchema`。
- 每个 step 必须声明 `allowedTools`。
- `review` 和 `manual` 必须 `requiresApproval: true`。
- 有副作用的写入必须声明 `writesTo`。

## 7. 推荐第一条深链路

优先做 `sales-pipeline`。

原因：

- 输入清楚：客户询盘、客户资料、产品需求。
- 判断清楚：线索质量、风险、缺失信息。
- 审批必要：跟进邮件和报价相关内容必须人工确认。
- 写回明确：CRM、销售资产、知识资产。

建议固定步骤：

```text
1. intake
   收集询盘字段，补齐来源、语言、产品线、客户要求。

2. qualify
   结构化判断线索优先级、风险、缺失信息。

3. draft_outreach
   生成跟进邮件或话术草稿。

4. human_review
   人工确认语气、事实、价格/交期风险、下一步动作。

5. writeback
   写回 CRM、sales asset、knowledge asset。
```

这条链路跑通后，再迁移 support 和 creator。

## 8. 开发顺序

下一步具体实施计划见：

- [Controlled Agent Runtime Next Steps Implementation Plan](superpowers/plans/2026-07-05-controlled-agent-runtime-next-steps.md)
- [Controlled Run Asset Writeback Implementation Plan](superpowers/plans/2026-07-05-controlled-run-asset-writeback.md)
- [Runtime Console Trace And Asset Landing Implementation Plan](superpowers/plans/2026-07-05-runtime-console-trace-asset-landing.md)
- [Runtime Console Operations Implementation Plan](superpowers/plans/2026-07-05-runtime-console-operations.md)
- [Runtime Console Asset Deep Links Implementation Plan](superpowers/plans/2026-07-05-runtime-console-asset-deep-links.md)
- [Runtime Console Failure Recovery Implementation Plan](superpowers/plans/2026-07-05-runtime-console-failure-recovery.md)
- [Runtime Console Record-Level Asset Focus Implementation Plan](superpowers/plans/2026-07-06-runtime-console-record-level-asset-focus.md)
- [Runtime Console Workflow And Draft Deep Links Implementation Plan](superpowers/plans/2026-07-06-runtime-console-workflow-draft-deep-links.md)
- [Support Playbook Migration Implementation Plan](superpowers/plans/2026-07-06-support-playbook-migration.md)
- [Trace Fixture Replay Runner Implementation Plan](superpowers/plans/2026-07-06-trace-fixture-replay-runner.md)
- [Trace Fixture Catalog And Support Coverage Implementation Plan](superpowers/plans/2026-07-06-trace-fixture-catalog-support-coverage.md)
- [Trace Fixture Drift Diagnostics Implementation Plan](superpowers/plans/2026-07-06-trace-fixture-drift-diagnostics.md)
- [Trace Fixture Catalog Report Implementation Plan](superpowers/plans/2026-07-06-trace-fixture-catalog-report.md)
- [Trace Fixture Catalog CI Summary Implementation Plan](superpowers/plans/2026-07-06-trace-fixture-catalog-ci-summary.md)
- [Governed Trace Fixture Builder CLI Implementation Plan](superpowers/plans/2026-07-06-governed-trace-fixture-builder-cli.md)
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
- [Fixture Replay Failure Documentation Matrix Implementation Plan](superpowers/plans/2026-07-06-fixture-replay-failure-documentation-matrix.md)
- [Fixture Replay Refresh Review Checklist Implementation Plan](superpowers/plans/2026-07-06-fixture-replay-refresh-review-checklist.md)
- [Fixture Replay CI Gate Documentation Implementation Plan](superpowers/plans/2026-07-06-fixture-replay-ci-gate-documentation.md)
- [Fixture Replay Catalog Expansion Review Implementation Plan](superpowers/plans/2026-07-06-fixture-replay-catalog-expansion-review.md)
- [Trace Governance Operational Runbook Implementation Plan](superpowers/plans/2026-07-06-trace-governance-operational-runbook.md)

### 8.1 当前进度快照（2026-07-06）

已完成：

- Phase 0 方向冻结：项目主线已经收口为可控 Skill / Playbook Runtime。
- Phase 1 固定 plan 来源：`sales-pipeline-v1` 已有固定 playbook、resolver、validator，并通过 `test:controlled-runtime` 覆盖。
- Phase 2 基础 step schema 和工具策略：playbook step 已声明输入输出 schema、allowed tools、approval requirements；受控输出校验已接入执行链。
- Phase 3 的 durable run / approval / resume 基线：controlled run store、approval record、resume route、client-side resume/recovery 已打通。
- Client recovery：审批后 resume、手动 resume、stream loss、resume conflict、approval-in-flight 后 stream loss 等路径都有回归测试。
- Phase 4 资产写回闭环：approved `sales-pipeline-v1` final writeback 已能写入 server-backed sales asset 和 knowledge asset，并把真实 receipt 记录回 controlled step trace。
- Phase 5 第一批 Runtime Console trace landing：控制台可以列出 recent controlled runs，并展示 selected run 的 step trace、approval、schema、writeback receipt 和 sales/knowledge asset landing labels。
- Phase 6 Runtime Console operations：控制台已经支持 state filter、文本搜索、pending approval approve/reject、non-terminal run resume，并在操作后刷新 durable controlled run summary。
- Phase 7 第一批 asset deep links：writeback receipt 已记录结构化 `assetId` / `sourceKey` / `workflowRunId`，Runtime Console 可按资产字段搜索，并能从成功 landing 打开 Deal Desk / Knowledge Vault。
- Phase 7b failure recovery：controlled run 已有 durable audit events；summary 可展示 `failedStepId`、`canRetry`、`retryReason` 和 `auditEventCount`；Runtime Console 可对符合 playbook retry policy 的 failed step 执行 `重试失败步骤`；retry route 会从第一个失败 step 继续执行，不重放已完成前置步骤。
- Phase 7c record-level asset focus：Runtime Console 的 sales / knowledge asset landing 现在会传递 `assetId` / `sourceKey` / `workflowRunId`；Deal Desk 会定位到已写回 sales asset 关联的现有 deal；Knowledge Vault 会定位并高亮 exact knowledge asset。带 record metadata 的打开动作不会创建 synthetic lead；如果 prefill 早于 server-backed store hydration，会保留 pending focus，在资产/线索同步后重试，仍未命中则提示缺失记录。
- Phase 7d complete skipped writeback targets：`workflow_run` 和 `draft` target 已从 skipped receipt 升级为真实 server-backed 写回。workflow run 使用稳定 `workflowRunId` upsert；draft 使用 `controlled-draft:{workflowRunId}` upsert；final approved writeback 会把 workflow run 状态推进到 `completed`。
- Phase 7e workflow/draft deep links：Runtime Console 的 landing panel 已覆盖 `workflow_run` 和 `draft` receipt。workflow run landing 会打开 Industry Hub 并定位对应 workflow run / scenario；draft landing 会打开 Publisher 并带入 `draftId`、`workflowRunId`、scenario 和下一步处理上下文。
- Phase 8 support playbook migration：`support-resolution-v1` 已成为第二条 controlled playbook。它复用现有 resolver / validator / approval gate / writeback / Runtime Console summary，固定执行 intake、classify、draft_reply、human_review、writeback，并能写回 support asset、draft、workflow run 和 support FAQ knowledge asset。
- Phase 9 support record focus：Runtime Console 的 support asset landing 已传递 `assetId` / `sourceKey` / `workflowRunId`；Support Copilot 会把 exact support asset prefill 当作 record-focus 请求，定位关联的现有 support ticket。prefill 早于 support asset / ticket store hydration 时会保留 pending focus 并在同步后重试；仍缺失时提示错误，不创建 synthetic support ticket。旧 broad support prefill 继续创建新工单。
- Phase 10 trace governance artifact slice：已新增 governed trace artifact builder 和本地 `trace-artifact` route。它保留 run/playbook/step/approval/writeback/audit 的结构化元数据，同时脱敏 step input/output、tool output、approval feedback、audit message、run/step error、plan goal 和 step description。原始 controlled run store 和 Runtime Console 操作路径保持不变。
- Phase 10b trace governance console export and retention：Runtime Console selected run 已有 `复制脱敏 Trace` 动作，会从 governed `trace-artifact` route 获取 `{ export, artifact }` 并复制 JSON；store 层已有 `pruneControlledExecutionRuns()`，只清理旧 terminal run，保留 `running` 和 `awaiting_approval` run。
- Trace Operations Retention Preview：store 层已新增 `previewControlledExecutionRunRetention()`，用于在执行 prune 前输出 normalized policy、cutoff、kept/pruned run ids 和逐条 retention reason。`pruneControlledExecutionRuns()` 复用同一套 decision helper，避免 dry-run 和实际清理规则漂移。
- Trace Retention Preview CLI：已新增 `npm run trace:retention:preview`，把 retention dry-run 暴露为本地维护命令。该命令输出 machine-readable JSON，支持 `--cwd` 指向显式工作区，不执行 prune、不刷新 fixture、不导出 artifact、不调用 replay。
- Trace Retention Prune Guard：已新增 `npm run trace:retention:prune`，真正执行清理前必须提供 `--confirm-prune` 和与 fresh preview 完全一致的 `--expected-pruned-run-ids`。`none` 只在 fresh preview 无候选时作为 no-mutation handoff 使用；该阶段仍不做定时清理、不做 UI、不做真实 replay。
- Delivery Release Gate Hardening：已新增 `npm run delivery:ready:check`，把 delivery demo check、governed fixture report、fixture summary 和 retention preview 聚合为 fast local delivery readiness JSON。该命令只允许 `local_delivery_demo_ready` claim，并固定 `productionReady: false`；它不替代完整 regression、lint、build 或 browser smoke。
- Phase 10c trace fixture generation：已新增 `trace-fixtures.ts`，可把 governed trace artifact 转换成稳定 regression fixture；fixture validation 会检查 redaction boundary、step order、known playbook match、tool output redaction、approval/schema/writeback metadata，并已有 sales pipeline sample fixture。
- Phase 10d trace fixture replay runner：已新增 `trace-replay.ts`，可用 committed governed fixture 校验当前 playbook 合约。replay 会先执行 fixture validation，再检查 playbook 是否注册、step order 是否匹配、requiresApproval step 是否有 approval state、每个 playbook `writesTo` target 是否在同一步 fixture metadata 中出现。该 runner 是纯校验，不调用 LLM、不调用工具、不写 store、不写资产。
- Phase 10e trace fixture catalog and support coverage：已新增 explicit governed fixture catalog，并补齐 `support-resolution-v1` governed fixture。`test:controlled-runtime` 现在会通过 catalog replay 同时覆盖 sales/support committed fixtures。
- Phase 10f trace fixture drift diagnostics：`replayControlledTraceFixture()` report 已增加结构化 `diagnostics`，包含 fixture id、playbook id、expected step order、fixture step order、missing approval step ids 和 missing writeback targets。现有 `errors` 字符串保持稳定，catalog replay 仍是纯校验。
- Phase 10g trace fixture catalog report：已新增 `buildControlledTraceFixtureCatalogReport()`，可以把 explicit catalog 中每个 fixture 的 validation、replay、diagnostics 和 no-side-effect guarantees 聚合到一个 report object。synthetic drift 覆盖证明 report item 会保留 Phase 10f diagnostics。
- Phase 10h trace fixture catalog CI summary：已新增 `npm run trace:fixtures`，输出 compact JSON catalog health summary，并在 report 不通过时以非零退出码失败。该命令已纳入 `test:controlled-runtime` 覆盖。
- Phase 10i governed trace fixture builder CLI：已新增 `npm run trace:fixture:build -- <artifact.json>`，可以把一个 governed trace artifact JSON 文件转换为经过 validation 的 fixture JSON，并输出到 stdout。缺文件、非法 JSON、非法 artifact shape 会以非零退出码和稳定 stderr diagnostics 失败。该命令不自动改写 committed fixture。
- Phase 10j governed fixture refresh review workflow：已新增 `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`，固定 fixture refresh 的人工审查路径：导出 governed artifact、运行 builder、审查 candidate fixture、手工替换 committed fixture、运行 catalog/runtime gates，并保持 no-side-effect 边界。
- Phase 10k fixture replay depth and golden invariants：pure replay 已进一步校验 playbook version、scenario、plan id、step count、approval flag、completed attempts、approval terminal state，以及成功 writeback receipt 的 `assetId` / `sourceKey` / `workflowRunId` 稳定 metadata。该阶段仍然不重放工具、不调用 API、不读写 store、不写资产。
- Phase 10l fixture replay contract documentation：已新增 `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`，把 replay invariant matrix、diagnostics fields 和 failure triage 文档化，并从 fixture refresh workflow 链接过去。
- Phase 10m fixture replay error summary CLI：已新增 `npm run trace:fixtures:summary`，从同一个 catalog report 输出 human-readable replay summary；原有 `npm run trace:fixtures` 继续保持 machine-readable JSON。该命令不发现 fixture、不刷新 fixture、不调用 route、不重放工具、不读写 store、不写资产。
- Phase 10n fixture replay failure fixture tests：已新增 test-only reusable synthetic failure fixture factories，用于 report/summary drift 覆盖；committed governed fixture catalog 继续保持全绿，不新增 failing catalog JSON，不发现 fixture、不刷新 fixture、不调用 route、不重放工具、不读写 store、不写资产。
- Phase 10o fixture replay failure exit-code harness：已新增 direct-invoked synthetic failure harness，用于验证 failed report/summary subprocess 非零退出；committed `trace:fixtures` 和 `trace:fixtures:summary` 继续只读取 committed catalog 并保持全绿。JSON report 输出 shape 已抽为共享 helper，避免 harness 与正式 JSON 命令漂移。
- Phase 10p fixture replay validation failure fixtures：已新增 reusable synthetic validation failure factories，覆盖缺失 `sourceRunId`、未脱敏 step input、未脱敏 tool output，并在 report/summary 测试中验证 validation errors 会被保留和展示。committed governed fixture catalog 和 committed CLI commands 继续保持全绿。
- Phase 10q fixture replay failure documentation matrix：已在 replay contract guide 中新增 failure fixture matrix，把 validation failure、replay drift、summary diagnostics 和 process exit harness 对应到具体 factories、测试文件、诊断和维护动作。synthetic failures 明确保持 test-only，不进入 committed governed fixture catalog。
- Phase 10r fixture replay refresh review checklist：已把 governed fixture refresh 的候选 fixture 审查拆成 source identity、redaction、playbook contract、approval、writeback identity、failure triage、sensitive search 和 replacement diff gates。失败分类链接到 replay contract failure fixture matrix。
- Phase 10s fixture replay CI gate documentation：已新增 governed trace fixture CI gate guide，明确 `trace:fixtures` 是自动化 JSON contract，`trace:fixtures:summary` 是人读 triage，`trace:fixture:build` 只属于人工 refresh workflow。
- Phase 10t fixture replay catalog expansion review：已新增 catalog coverage guide，确认当前 sales/support completed fixtures 覆盖所有注册 playbook、当前 writeback target family、approved approval path、redaction metadata 和 stable writeback identity；本阶段不新增 fixture JSON。
- Phase 10u trace governance operational runbook：已新增 governed trace operational runbook，把 artifact export、intent classification、fixture candidate build、refresh review、catalog gates、retention cleanup、failure escalation 和 real replay boundary 串成维护者执行路径。
- Phase 10v real replay boundary design：已新增 `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`，明确 future real replay 的 input provenance、sandbox ownership、credential isolation、approval simulation、store isolation、side-effect blocking、replay result artifact ownership 和 stop conditions。该阶段仍不实现 LLM replay、tool execution、route calls、store 读写或资产写回。
- Phase 10w replay sandbox contract types：已新增 `src/lib/executor/runtime/replay-sandbox-contracts.ts`，用 TypeScript-only contract 和 `validateReplaySandboxContract()` 编码 replay input provenance、sandbox context、credential policy、approval simulation、store isolation、side-effect policy 和 replay result artifact。测试覆盖 safe contract、raw controlled run、live credential、live approval、production store access 和 business asset write rejection，并已纳入 `test:controlled-runtime`。
- Phase 10x no-side-effect replay sandbox prototype design：已新增 `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`，定义未来 `replay-sandbox.ts` module boundary、`runNoSideEffectReplaySandbox()` API shape、preflight validation、failure artifact、replay-local state、cursor events、approval simulation、side-effect blocking、result artifact ownership 和 implementation stop conditions。该阶段未实现 prototype。
- Phase 10y no-side-effect replay sandbox prototype implementation：已新增 `src/lib/executor/runtime/replay-sandbox.ts` 和 `runNoSideEffectReplaySandbox()`。Prototype 只消费 `ReplaySandboxContract`，先执行 `validateReplaySandboxContract()`；unsafe contract 返回 failed replay result artifact 且 cursor 只到 `preflight`；safe contract 返回 replay-local result artifact。该阶段仍不执行 LLM replay、tool execution、route calls、runtime store reads/writes 或 business asset writes。
- Phase 10z governed fixture to replay sandbox contract bridge：已新增 `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts` 和 `buildReplaySandboxContractFromFixture()`。Bridge 把 committed governed fixture metadata 转成 `ReplaySandboxContract`，拒绝 broken provenance / redaction boundary，并证明 sales/support fixtures 可进入 no-side-effect replay sandbox prototype。该阶段仍不恢复 raw governed artifact payload、不修改 fixture JSON、不执行真实工具、不调用 route、不读写 runtime store、不写资产。
- Phase 10aa catalog-level replay sandbox report：已新增 `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts` 和 `buildReplaySandboxCatalogReport()`。Report 把 explicit committed fixture catalog 跑过 `fixture -> ReplaySandboxContract -> no-side-effect replay result artifact`，汇总 contract build result、sandbox artifact、diagnostics 和 no-side-effect guarantees。该阶段仍不执行 LLM replay、tool execution、route calls、runtime store reads/writes、fixture JSON mutation 或 business asset writes。
- Phase 10ab replay sandbox catalog CI summary：已新增 `npm run replay:sandbox:fixtures`、`scripts/trace-fixtures/replay-sandbox-catalog-report.mjs` 和 test-only failure harness。命令输出 compact JSON，并在 report 不通过时以非零退出。该阶段仍不执行 LLM replay、tool execution、route calls、runtime store reads/writes、fixture JSON mutation 或 business asset writes。
- Phase 10ac replay sandbox failure diagnostics hardening：已为 replay sandbox catalog report 增加 `contract_build_failed`、`sandbox_artifact_failed` 和 `guarantee_violation` taxonomy，并在 compact failed JSON 中输出 `failureKind` 和 `guaranteeErrors`。该阶段通过 synthetic/test-only failures 覆盖 contract build、sandbox artifact 和 no-side-effect guarantee violation，committed fixture catalog 继续保持全绿。
- Phase 10ad replay sandbox failure harness expansion：已为 `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs` 增加 `contract`、`sandbox` 和 `guarantee` direct modes。每个 supported mode 都输出 parseable compact JSON 并以 `1` 退出；unknown mode 以 `2` fail closed 且不输出 report JSON。committed `replay:sandbox:fixtures` 继续保持全绿。
- Runtime UI Delivery Polish：已新增 Runtime Console 交付 handoff 摘要，可一眼查看 recent runs、pending approvals、retryable failures、asset landings 和 governed trace candidates。该阶段只改善交付可读性，没有改变 runtime 行为、app shell 架构、审批语义、写回语义或 trace governance。

仍未完成：

- Fixture 目前只验证 playbook/trace metadata，还不重放真实工具调用。
- governed fixture / playbook expansion review 已确认当前 sales/support committed governed fixture 覆盖所有注册 controlled playbook，暂不新增 fixture JSON 或迁移新 playbook。
- 真实 replay 执行仍未实现；已完成边界设计、TypeScript contract 校验、no-side-effect prototype design、最小 prototype implementation、governed fixture -> replay sandbox contract bridge、catalog-level replay sandbox report、replay sandbox catalog CI summary、failure diagnostics taxonomy 和 direct failure harness modes。
- Runtime UI 只进入交付可读性 polish，不进入全量 UI 重构。
- 本地 mutation executor 已有 manifest preview/apply 边界，post-apply audit sequence、evidence、fixture refresh handoff、candidate fixture review、fixture replacement handoff、post-replacement evidence、release handoff review、handoff summary、delivery candidate 和 production release policy 已有只读门禁，但还没有 production release approval packet、实际 packaging/tag/upload/deploy 执行门禁、部署验证、统一 policy/guardrail hardening 或生产化发布审批。

因此下一阶段默认进入：

**Production Release Approval Packet**

目标是在 delivery candidate 与 production release policy 边界之上补齐结构化人工发布批准包，明确 reviewer、approval scope、expiry、rollback owner、monitoring owner、packaging/tag/upload/deploy/external-write 决策和下一步执行前置条件。该阶段仍不恢复 raw governed artifact payload、不直接刷新 committed fixture JSON、不执行真实工具、不调用 route、不写外部资产、不发布 release、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。

### Phase 0. 冻结方向

目标：

- 停止扩壳。
- 停止新增普通 skill。
- 把 runtime 作为主线写入文档和 backlog。

完成标准：

- 本手册成为后续开发判断标准。
- Roadmap / Next Steps 后续围绕 controlled runtime 更新。

### Phase 1. 固定 plan 来源

目标：

- `/api/agent/stream` 支持接收受控 `ExecutionPlan` 或 `playbookId`。
- 后端能从 playbook resolver 构造 plan。
- `runMultiStepTask` 不再默认只依赖 LLM planner。

关键改动：

- `src/lib/executor/contracts.ts`
- `src/lib/executor/core.ts`
- `src/app/api/agent/stream/route.ts`
- `src/lib/executor/workflow-bridge.ts`
- 新增 `src/lib/executor/playbooks/*`

完成标准：

- 同一个 `sales-pipeline` 每次生成相同步骤。
- 模型不能改变 step 顺序、工具和审批点。

### Phase 2. 强化 step schema 和工具策略

目标：

- 每个 step 有输入输出 schema。
- 工具调用参数必须校验。
- 输出不符合 schema 时进入失败或人工处理。

关键改动：

- `src/lib/executor/contracts.ts`
- `src/lib/executor/step-executor.ts`
- `src/lib/executor/tools/registry.ts`
- 新增 schema validator。

完成标准：

- 错误输出不会被当成成功结果推进 workflow。
- 高风险工具不能绕过审批。

### Phase 3. 持久化 approval 和 trace

目标：

- approval 不再只存在内存。
- trace 可按 workflow run 查询。
- 失败可复盘。

关键改动：

- `src/lib/executor/approval-store.ts`
- `src/lib/server/*`
- `src/app/api/runtime/executor/*`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`

完成标准：

- 刷新页面后 pending approval 不丢。
- 执行失败能看到失败 step、工具结果和错误原因。

### Phase 4. 资产写回闭环

目标：

- sales workflow 的 approved output 写入 CRM / sales asset / knowledge asset。
- 区分草稿、已批准结果、长期资产。

关键改动：

- `src/lib/executor/runtime/writeback.ts`
- `src/lib/executor/step-executor.ts`
- `src/lib/server/sales-asset-store.ts`
- `src/lib/server/knowledge-asset-store.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/__tests__/lib/executor/runtime/resume.test.ts`

完成标准：

- 一次完整 sales run 结束后，controlled trace 能记录保留了什么资产，以及这些资产来自哪次 run。
- approved final writeback 写入 sales asset 和 knowledge asset。
- 重复 resume / writeback 不产生重复资产。
- unapproved output 不进入高信任资产。

### Phase 5. UI 收缩成 Runtime Console

目标：

- UI 不再表现为“大而全 OS”。
- 首页和控制台突出可控执行状态。

需要展示：

- 当前 playbook
- 当前 step
- 待审批项
- 失败项
- 最近 trace
- 写回资产
- runtime health

完成标准：

- 用户能一眼知道“机器在执行什么、卡在哪里、需要我确认什么、结果去了哪里”。
- Runtime Console 至少能列出 recent controlled runs。
- Runtime Console 能展示 selected run 的 step trace、approval 决策、schema validation、writeback receipt 和资产落点标识。

### Phase 6. Runtime Console Operations

目标：

- 让 Runtime Console 不只是查看 trace，而是能处理当前受控运行的最小操作闭环。
- 让 pending approval 和 resumable controlled run 不再只能依赖侧栏或手动恢复入口。

已完成能力：

- recent controlled runs 可按状态过滤。
- recent controlled runs 可按 run id、workflowRunId、playbookId、title、summary、error 文本搜索。
- awaiting approval 的 run 会暴露 `pendingApprovalStepId` 和 `canApprove`。
- non-terminal run 会暴露 `canResume`。
- Runtime Console 可直接 approve / reject pending approval。
- Runtime Console 可直接 resume 非终态 controlled run。
- 操作完成后重新加载 durable controlled run list，避免 UI 长时间停留在旧状态。

完成标准：

- 用户可以从 Runtime Console 判断“哪个 run 等我审批”，并直接 approve / reject。
- 用户可以从 Runtime Console 判断“哪个 run 可以继续”，并直接 resume。
- summary helper 的可操作状态和过滤行为有单元测试覆盖。
- `test:controlled-runtime`、`test:core-workflows`、lint、build 通过。

### Phase 7. Runtime Console Deep Links And Failure Recovery

目标：

- 把 trace 里的资产落点变成真正可跳转、可定位、可复盘的业务入口。
- 把失败恢复从 generic resume 扩展到更精确的 failed step retry / restart controls。

第一批已完成：Asset Deep Links

- `ControlledWritebackReceipt` 支持结构化 `assetId`、`sourceKey`、`workflowRunId`。
- sales asset / knowledge asset 成功写回时会把真实资产 id 写入 receipt。
- Runtime Console summary 会把 receipt 转换为带 `appId` 的 asset landing。
- Runtime Console search 已覆盖 asset id、source key、workflow id、receipt summary 和 run error。
- Runtime Console 成功 asset landing 可打开 Deal Desk 或 Knowledge Vault，并带入 workflow/query 上下文。

第二批已完成：Failure Recovery

- controlled run 记录新增 `auditEvents`，用于持久化 console-initiated recovery 动作。
- Runtime Console summary 新增 `failedStepId`、`canRetry`、`retryReason`、`auditEventCount`。
- `retryControlledExecutionRun(runId)` 会按 playbook 顺序找到第一个 failed step，并且只在该 step 声明 `onFailure.action === "retry"` 时允许重试。
- retry route 复用受控 multi-step execution，从 failed step 的 index 继续执行，保留已完成前置 step 的结果。
- Runtime Console selected run detail 会展示 failed step / recovery 信息，并只在 eligible failed run 上显示 `重试失败步骤`。

建议拆分：

- record-level focus：Deal Desk / Knowledge Vault 根据 prefill 直接选中 sales asset / knowledge asset，并覆盖 hydration race 下的 pending retry / missing-record error。已完成于 Phase 7c。
- skipped writeback targets：把 `workflow_run` / `draft` 从 skipped receipt 升级为真实写回。已完成于 Phase 7d。
- workflow/draft deep links：Runtime Console 增加 workflow run / draft record open actions，避免只显示 receipt 文本。已完成于 Phase 7e。
- 操作审计增强：把 console-initiated approve / reject / resume 也明确记录到 trace metadata，目前 retry 已有 audit event。

完成标准：

- 用户能从一次 controlled run 直接跳到它写回的业务资产所在业务面板。
- 用户能筛出某个 workflowRunId、playbookId 或 asset id 的 controlled runs。
- failed run 不再只显示错误文本，而能展示下一步可执行恢复动作。
- `workflow_run` / `draft` target 能写入对应业务状态，并能从 Runtime Console 直接打开。

### Phase 8. Support Playbook Migration

目标：

- 把 support scenario 迁移成第二条 controlled playbook。
- 验证 controlled runtime 的 playbook resolver、validator、approval gate、writeback 和 Runtime Console trace 对多业务线复用。
- 避免为 support 单独做特殊 UI 分支，优先复用现有 Runtime Console summary、landing 和 writeback receipt 模型。

建议固定步骤：

```text
1. intake
   收集客户问题、来源、紧急程度、相关订单/产品信息。

2. classify
   判断问题类型、优先级、风险和缺失信息。

3. draft_reply
   生成客服回复草稿和内部处理建议。

4. human_review
   人工确认事实、承诺边界、语气和下一步动作。

5. writeback
   写回 support asset、draft、workflow run，并沉淀可复用 knowledge asset。
```

完成标准：

- `support-resolution-v1` 有显式 playbook schema、step input/output schema、allowed tools 和审批节点。
- validator 能拒绝未知 support step、未授权工具和绕过审批的执行请求。
- final approved writeback 能写入 support/draft/workflow/knowledge 相关资产，并保持 idempotency。
- Runtime Console 能显示 support controlled run 的 trace、approval、writeback receipts 和 asset landings，不需要为 support 新增独立 trace UI。
- `test:controlled-runtime` 覆盖 support playbook resolver、validator、execution、approval、writeback 和 Runtime Console summary。

当前状态：已完成。

已交付：

- `support-resolution-v1` fixed playbook。
- Catalog 可按 `support-resolution-v1` 和 `support-ops` 解析。
- Support controlled run 可在不调用 planner fallback 的情况下执行固定步骤。
- `support_asset` 写回到 server-backed support asset store，并以 `controlled-support-asset:{workflowRunId}` 保持幂等。
- Support final writeback 可沉淀 `support_faq` knowledge asset。
- Runtime Console summary/search 已覆盖 support asset landing。
- Runtime Console support asset landing 可打开 Support Copilot 并带入 workflow context。

### Phase 9. Support Runtime Console Record Focus

目标：

- 让 Runtime Console 的 support asset landing 打开 Support Copilot 后，直接定位到对应 support asset / ticket。
- 对齐此前 Deal Desk / Knowledge Vault 的 record-level focus 行为。
- 保持旧 receipt 的 broad fallback，不因为缺少结构化 metadata 而误创建重复 support records。

完成范围：

- `SupportCopilotPrefill` 已增加可选 `assetId`、`sourceKey` 聚焦字段，并复用 `WorkflowContextMeta.workflowRunId`。
- `src/lib/support-assets.ts` 已增加 `getSupportAssetById`、`getSupportAssetBySourceKey`、`getSupportAssetForFocus`。
- Runtime Console 已把 support asset receipt 的 `assetId`、`sourceKey`、`workflowRunId` 传给 Support Copilot。
- Support Copilot 接收 exact support asset prefill 后优先定位关联 ticket，不创建新工单。
- 找不到 exact 记录时保留 pending focus，在 support asset / ticket store 更新后重试；仍缺失时提示错误。
- 旧 broad support prefill 保持创建新工单的行为。

完成标准：

- Runtime Console support asset landing 能定位 exact support asset / ticket。已完成。
- support asset prefill 早于 store hydration 时不会静默失败。已完成。
- exact record 缺失时提示错误，不创建 synthetic support ticket。已完成。
- legacy support receipts without structured metadata 保持 broad Support Copilot fallback。已完成。

### Phase 10. Trace Governance

目标：

- 明确 controlled run trace 的保留、脱敏、导出、回放和 fixture 生成规则。
- 把 Runtime Console 中已经可见的 trace 升级为可审计、可分享、可测试复现的产品能力。

已完成范围：

- 定义并实现 governed trace artifact helper：`src/lib/executor/runtime/trace-governance.ts`。
- 新增本地安全 route：`GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`。
- 默认脱敏 step input/output、tool output、approval feedback、audit message、run/step error、plan goal 和 step description。
- 保留结构化审计字段：run id、playbook id、scenario/workflow id、step state/timing、approval state/timing、schema status、writeback asset/source/workflow metadata、audit event actor/type/timing。
- 把 governance helper 和 route 测试加入 `test:controlled-runtime`。
- 保持原始 controlled run store 和 Runtime Console 操作路径不变。

仍待完成：

- Runtime Console 中展示 trace governance 状态或导出入口。
- 定义 trace retention 策略和手动清理路径。
- 支持从 selected controlled run 生成脱敏测试 fixture。

完成标准：

- Trace redaction 有单元测试覆盖。已完成。
- Local trace artifact route 不导出未脱敏 step payload。已完成。
- Runtime Console 不会导出未脱敏敏感字段。已完成 governed trace copy action。
- 关键 controlled run 可以生成可复现 fixture。已完成 governed artifact、fixture builder、fixture replay runner 和 builder CLI。
- 手册中明确哪些 trace 字段允许长期保留，哪些必须脱敏或清理。Phase 10b 已完成 raw run prune helper；长期自动清理策略可在后续运营化。

### Phase 10b. Trace Governance Console Export And Retention

目标：

- 让 Runtime Console 可以获取 governed trace artifact。
- 明确 raw controlled run trace 的 retention / cleanup 规则。

已完成范围：

- Runtime Console selected run 已增加 governed artifact copy action：`复制脱敏 Trace`。
- Trace artifact route 已返回 fixture-oriented `filename`、`generatedAt`、`contentType` 和 `governanceMode`。
- Store 层已增加 `ControlledRunRetentionPolicy` 和 `pruneControlledExecutionRuns()`。
- Retention / prune 测试已覆盖：不会删除 `running` / `awaiting_approval` runs，会清理旧 terminal runs，并保留最低数量的 terminal runs。

完成标准：

- 操作者可以从 Runtime Console 获取 governed trace artifact。已完成。
- Raw trace 清理不会影响 running / awaiting approval runs。已完成。
- governed artifact 可作为未来回归 fixture 的输入。已完成 artifact 输入边界、fixture builder、fixture replay runner 和本地 builder CLI。

### Phase 10c. Trace Fixture Generation

目标：

- 把 governed trace artifact 转换为稳定 regression fixture。
- 为 controlled runtime replay / fixture 验证建立最小可用入口。

已完成范围：

- 新增 trace fixture builder，接收 governed artifact 并输出不含敏感 payload 的 fixture。
- 建立 `src/__tests__/fixtures/controlled-traces/` fixture 样例。
- 增加 fixture validation 测试，确保 artifact schema、step ids、writeback metadata 可用于回归。
- 暂不重放真实工具调用，先验证 fixed playbook shape 和 governance boundary。

完成标准：

- 已导出的 governed artifact 可以进入 fixture builder。已完成。
- fixture 中不包含 raw input/output/tool output。已完成。
- fixture 能验证 playbook id、step order、approval/writeback metadata。已完成。

### Phase 10d. Trace Fixture Replay Runner

目标：

- 用 committed governed fixtures 持续验证当前 playbook 合约。
- 在不调用真实工具的前提下，检测 playbook step order、approval boundary、writeback target 是否和 fixture 兼容。

已完成范围：

- 新增 `trace-replay.ts`，读取 `ControlledTraceFixture` 并生成 replay validation report。
- 校验 fixture 的 step order 是否仍匹配当前 controlled playbook。
- 校验 fixture 中 approval/writeback metadata 是否符合当前 playbook 预期。
- 增加 sales pipeline fixture replay 测试。
- replay report 明确声明 `toolCallsExecuted: false` 和 `assetsWritten: false`。
- sales sample fixture 已对齐当前 `sales-pipeline-v1` 的 approval / writeback target 合约。

完成标准：

- sample fixture 可通过 replay validation。已完成。
- 修改 playbook step order 时 replay validation 能失败。已完成。
- 缺失 approval state / writeback target / playbook 注册时 replay validation 能失败。已完成。
- 不调用 LLM、不调用工具、不写回资产。已完成。

### Phase 10e. Trace Fixture Catalog And Support Coverage

目标：

- 把单个 sales fixture replay 扩展为 fixture catalog。
- 为 `support-resolution-v1` 增加 committed governed fixture。
- 让 `test:controlled-runtime` 一次性 replay 所有 committed fixtures。

已完成范围：

- 新增 catalog helper，列出 `src/__tests__/fixtures/controlled-traces/` 下当前受支持 fixture。
- 新增 support governed fixture，保留 step order、approval state、schema/writeback target metadata 和 redaction boundary。
- 增加 catalog replay 测试，遍历所有 fixture 并输出稳定 failure message。
- 保持纯校验，不做工具 replay、不读写 runtime stores、不新增导入 route。

完成标准：

- Sales 和 support fixture 都能通过 replay validation。已完成。
- 任一 fixture 对应 playbook step order、approval gate 或 writeback target 漂移时，catalog replay test 失败。已完成。
- `test:controlled-runtime` 覆盖 fixture catalog replay。已完成。

### Phase 10f. Trace Fixture Drift Diagnostics

目标：

- 增强 `replayControlledTraceFixture()` 的维护输出。
- 让 playbook 改动导致 fixture 失败时，可以直接看出 expected/current 差异。
- 保持当前 replay 的纯校验边界，不引入真实工具 replay。

已完成范围：

- 在 replay report 中增加必需的 `diagnostics` 字段。
- diagnostics 包含：
  - fixture id；
  - playbook id；
  - expected step order；
  - fixture step order；
  - missing approval step ids；
  - missing writeback targets，包含 step id 和 target。
- 现有 `errors` 保持稳定，避免破坏当前断言和 catalog replay。
- 增加 drift diagnostics 测试，覆盖成功路径、step order、approval、writeback drift 和 unknown playbook。

完成标准：

- Drift report 能清楚说明 fixture 与 playbook 的差异。已完成。
- Catalog replay 测试保持通过。已完成。
- 不调用 LLM、不调用工具、不读写 stores、不写资产。已完成。

### Phase 10g. Trace Fixture Catalog Report

目标：

- 把 catalog 中所有 committed governed fixtures 的 replay 结果聚合成一个稳定 report。
- 让 CI / 维护人员不用逐个看测试断言，也能知道哪个 fixture 漂移、漂移在哪里。
- 继续保持纯 metadata 校验，不进入真实工具 replay。

已完成范围：

- 新增 pure report helper，遍历 explicit fixture catalog。
- 每个 fixture report 包含 validation errors、replay errors、warnings、diagnostics 和 no-side-effect guarantees。
- 汇总字段包含 total、passed、failed、fixture ids、playbook ids。
- 增加测试覆盖 all-green catalog 和 synthetic drift fixture。

完成标准：

- 一个 report object 能说明整个 committed governed fixture catalog 的健康状态。已完成。
- CI failure 能定位 stale fixture，并携带 Phase 10f 的 drift diagnostics。已完成 report 层能力；独立 CI command 待 Phase 10h。
- 不调用 LLM、不调用工具、不读写 runtime stores、不写资产。已完成。

### Phase 10h. Trace Fixture Catalog CI Summary

目标：

- 给 Phase 10g 的 catalog report 增加本地命令入口。
- 让维护人员和 CI 可以直接输出 compact JSON report。
- 保持纯 metadata 校验边界，不新增 API/UI。

已完成范围：

- 新增本地脚本，调用 `buildControlledTraceFixtureCatalogReport()`。
- 输出 `ok`、`total`、`passed`、`failed` 和失败 item 的 diagnostics。
- report 不通过时进程以非零退出码结束。
- 增加 npm script 和脚本测试。

完成标准：

- 一个 focused command 可以检查 committed governed fixture catalog。已完成。
- fixture drift 时命令能输出 stale fixture id 和 diagnostics。已完成。
- 不调用 LLM、不调用工具、不读写 runtime stores、不写资产。已完成。

### Phase 10i. Governed Trace Fixture Builder CLI

目标：

- 从已经导出的 governed trace artifact JSON 构建 fixture JSON。
- 让 fixture refresh 工作变成本地显式命令，而不是手工复制字段。
- 继续保持纯 metadata / file input-output 边界，不读取 runtime stores。

已完成范围：

- 新增 `scripts/trace-fixtures/build-fixture.mjs`。
- 新增 `npm run trace:fixture:build -- <artifact.json>`。
- 命令接收一个 governed artifact JSON 文件路径。
- 命令调用 `buildControlledTraceFixture()` 和 `validateControlledTraceFixture()`。
- 成功时只把 fixture JSON 输出到 stdout。
- 缺文件、非法 JSON、非法 artifact shape 会把稳定诊断输出到 stderr，并以非零退出码结束。
- 增加 subprocess 测试覆盖成功、缺文件失败和非法 artifact shape 失败。
- 命令已纳入 `test:controlled-runtime`。

完成标准：

- 维护人员可以从 governed artifact 文件生成 fixture JSON。已完成。
- 命令不自动修改 committed fixture 文件，仍需人工审查。已完成。
- 不调用 LLM、不调用工具、不读写 runtime stores、不写资产。已完成。

### Phase 10j. Governed Fixture Refresh Review Workflow

目标：

- 把 governed fixture refresh 的人工维护路径写成固定 checklist。
- 明确 builder stdout、candidate fixture review、committed fixture 手工替换、catalog/runtime 验证之间的边界。
- 防止后续把 builder 扩展成绕过人工审查的自动 fixture 写回工具。

已完成范围：

- 新增 [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)。
- 文档规定 artifact 必须先处于 trace governance boundary 内，raw step input/output、tool output、approval feedback、audit message 和 free-form plan text 都应已脱敏。
- 文档规定 candidate fixture 通过 `npm run trace:fixture:build -- <artifact.json>` 生成到 stdout，重定向到临时文件是维护人员的显式动作。
- 文档规定 committed fixture 只能在审查 candidate fixture 后手工替换。
- 审查清单覆盖 schema version、playbook id/version、step order、approval state、writeback targets、redaction flags、tool output redaction 和敏感字符串搜索。
- 验证清单覆盖 `npm run trace:fixtures --silent`、`npm run test:controlled-runtime`、`npm run test:core-workflows`、`npm run lint`、`npm run build` 和 `git diff --check`。

完成标准：

- 维护人员可以按一份文档刷新 governed fixture。已完成。
- 文档明确 builder 不会自动修改 committed fixture。已完成。
- 不新增 API/UI、不调用 LLM/工具、不读写 runtime stores、不写资产。已完成。

## 9. 开发规范

### 9.1 新功能准入标准

任何新功能必须满足至少一项：

- 提高步骤确定性。
- 提高工具边界安全性。
- 提高审批可见性。
- 提高 trace 可复盘性。
- 提高资产写回质量。
- 提高失败恢复能力。

否则不进入主线。

### 9.2 不允许的实现方式

禁止：

- 用 prompt 代替 schema。
- 用 LLM planner 代替 playbook。
- 用 UI 状态代替 runtime 状态。
- 用 console log 代替 trace。
- 用 local component state 保存审批。
- 用自由文本结果直接写入高信任资产。
- 新增绕过 executor core 的执行 API。

### 9.3 LLM 的合法角色

LLM 可以做：

- 文本生成
- 摘要
- 分类建议
- 草稿生成
- 缺失信息提示
- 输出字段填充

LLM 不可以默认做：

- 决定最终流程
- 授权高风险工具
- 跳过人工审批
- 自行写入长期资产
- 修改 playbook 定义

### 9.4 Tool 的合法角色

工具必须：

- 有名字
- 有参数 schema
- 有权限等级
- 有副作用说明
- 有 trace result
- 高风险操作需要审批

### 9.5 Skill 的合法角色

Skill 必须逐步从 prompt fragment 升级为 runtime node。

短期可以保留当前 prompt 注入方式，但新增 skill 必须同时设计：

- 输入输出 contract
- 执行 receipt
- 失败分类
- 是否可自动执行
- 是否可写回资产

## 10. 测试和验收

### 10.1 最小回归测试

至少覆盖：

- playbook resolver 对同一 scenario 生成稳定 plan。
- plan validator 拒绝未知 step。
- plan validator 拒绝 forbidden tool。
- review/manual step 必须触发 approval。
- approval reject 后不会继续执行写回。
- tool failure 会进入 failed step。
- trace 记录 step、tool、approval、error。

### 10.2 推荐命令

当前仓库已有基础命令：

```bash
npm run test:core-workflows
npm run test:publish
npm run lint
npm run build
```

第一阶段 controlled runtime 专用回归：

```bash
npm run test:controlled-runtime
npm run test:core-workflows
```

`test:controlled-runtime` 是第一阶段的最小门禁，覆盖 sales playbook、plan validator、显式 controlled plan 执行和 workflow runner 请求收口。

截至 2026-07-07，`test:controlled-runtime` 已扩展为 controlled runtime 主线回归，覆盖 89 个测试文件、457 个测试，包括：

- sales/support playbook / validator / schema / step input。
- controlled run store、approval store、controlled execution、step executor、workflow bridge。
- durable resume、failed-step retry runtime、retry route、controlled run list / detail route。
- client stream recovery、Runtime Console retry UI wiring、runtime cockpit summary、record-level asset lookup、Deal Desk focus、Knowledge Vault focus、workflow/draft writeback、workflow/draft deep links、support asset writeback、support FAQ writeback、trace governance redaction、trace artifact route、Runtime Console governed trace copy、retention prune safety、governed trace fixture validation、fixture replay/catalog/summary/failure harness、playbook lifecycle change proposal / migration plan / maintenance sequence / sequence evidence / freshness / doctor / maintenance readiness / mutation approval / dry-run / preflight / executor / post-apply / fixture refresh handoff / candidate fixture review / fixture replacement handoff / post-replacement evidence / release handoff review / handoff summary gates、replay sandbox contracts、no-side-effect replay sandbox prototype、fixture-to-contract bridge、replay sandbox catalog report、replay sandbox catalog CI summary、replay sandbox failure diagnostics taxonomy、replay sandbox direct failure harness modes 和 idempotency。

Fixture replay 失败时，先通过 [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md#6-failure-fixture-matrix) 的 failure fixture matrix 分类。只有确认失败属于 intentional playbook drift 或 stale committed fixture 后，才进入 fixture refresh；validation failure、redaction failure、missing stable writeback metadata 或 harness behavior failure 必须先修源头，不允许直接手工改 fixture JSON。

### 10.3 手工验收场景

第一条验收链路：

```text
启动 sales-pipeline
-> 填入询盘
-> 自动 qualification
-> 生成 outreach draft
-> 停在 human review
-> 批准
-> 写回 sales asset / knowledge asset
-> trace 可查看
```

验收时必须确认：

- 步骤顺序固定。
- 审批点无法绕过。
- 输出结构可读。
- 写回目标明确。
- 失败时不会假装成功。

## 11. 文件落点建议

建议新增：

```text
src/lib/executor/playbooks/catalog.ts
src/lib/executor/playbooks/resolver.ts
src/lib/executor/playbooks/validator.ts
src/lib/executor/playbooks/sales-pipeline.ts
src/lib/executor/schema.ts
src/lib/server/executor-trace-store.ts
src/lib/server/executor-approval-store.ts
```

建议强化：

```text
src/lib/executor/contracts.ts
src/lib/executor/core.ts
src/lib/executor/step-executor.ts
src/lib/executor/workflow-bridge.ts
src/app/api/agent/stream/route.ts
src/lib/workflow-runs.ts
```

建议暂缓：

```text
src/apps/registry.ts
src/components/windows/*
新业务 app
新桌面视觉系统
```

## 12. 成功标准

这个方向成功，不是因为项目看起来像 OS。

成功标准是：

- 一个业务流程可以被固定步骤稳定跑完。
- agent 的自由度被限制在每个 step 内部。
- 高风险动作必须经过人工确认。
- 每次执行都有完整 trace。
- 结果能沉淀为可复用资产。
- 失败可以定位、复盘、重试或人工接管。

如果这些做不到，继续扩 UI 没有意义。

如果这些做到了，AgentCore OS 才有资格重新扩大成更完整的控制台、桌面壳或企业工作流平台。

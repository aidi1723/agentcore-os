# 可控 Agent Runtime 开发手册

Last updated: 2026-07-05

## 1. 项目新定位

AgentCore OS 后续不再优先朝“完整 AI OS 大壳”扩展，也不再投入做一个普通 skill。

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

**固定 workflow stage 和 LLM planner 并存，主执行链还没有把固定 playbook 作为唯一权威步骤来源。**

因此后续第一优先级不是加能力，而是收口控制权。

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
- [Runtime Console Trace And Asset Landing Implementation Plan](superpowers/plans/2026-07-05-runtime-console-trace-landing.md)
- [Runtime Console Operations Implementation Plan](superpowers/plans/2026-07-05-runtime-console-operations.md)

### 8.1 当前进度快照（2026-07-05）

已完成：

- Phase 0 方向冻结：项目主线已经收口为可控 Skill / Playbook Runtime。
- Phase 1 固定 plan 来源：`sales-pipeline-v1` 已有固定 playbook、resolver、validator，并通过 `test:controlled-runtime` 覆盖。
- Phase 2 基础 step schema 和工具策略：playbook step 已声明输入输出 schema、allowed tools、approval requirements；受控输出校验已接入执行链。
- Phase 3 的 durable run / approval / resume 基线：controlled run store、approval record、resume route、client-side resume/recovery 已打通。
- Client recovery：审批后 resume、手动 resume、stream loss、resume conflict、approval-in-flight 后 stream loss 等路径都有回归测试。
- Phase 4 资产写回闭环：approved `sales-pipeline-v1` final writeback 已能写入 server-backed sales asset 和 knowledge asset，并把真实 receipt 记录回 controlled step trace。
- Phase 5 第一批 Runtime Console trace landing：控制台可以列出 recent controlled runs，并展示 selected run 的 step trace、approval、schema、writeback receipt 和 sales/knowledge asset landing labels。
- Phase 6 Runtime Console operations：控制台已经支持 state filter、文本搜索、pending approval approve/reject、non-terminal run resume，并在操作后刷新 durable controlled run summary。

仍未完成：

- `workflow_run` 和 `draft` writeback 仍是显式 skipped receipt，后续需要接入对应 server store。
- Runtime Console 目前展示的是资产落点标识，还没有深度串联到具体 CRM / Knowledge Vault 记录的点击定位。
- Runtime Console 还没有失败重试 / retry policy 操作，也没有按 `playbookId`、`workflowRunId`、asset id 做更精确的深链过滤。

因此下一阶段默认进入：

**Phase 7. Runtime Console Deep Links And Failure Recovery**

目标是在已能查看和操作 trace 的基础上，补上业务落地定位和失败恢复：CRM / Knowledge Vault 深链跳转、失败 step retry / resume 控制、按 playbook / workflowRunId / asset id 的精确过滤。

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

建议拆分：

- 资产深链：从 writeback receipt 解析 sales asset / knowledge asset id，并跳转到对应 CRM / Knowledge Vault 记录。
- 精确过滤：按 `playbookId`、`workflowRunId`、run state、asset id 过滤 controlled run summary。
- 失败恢复：为 failed run 暴露可 retry 的 step、失败原因、可重试条件和审批风险。
- 操作审计：把 console-initiated approve / reject / resume / retry 明确记录到 trace metadata。

完成标准：

- 用户能从一次 controlled run 直接跳到它写回的业务资产。
- 用户能筛出某个 workflowRunId 或 playbookId 的所有 controlled runs。
- failed run 不再只显示错误文本，而能展示下一步可执行恢复动作。

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

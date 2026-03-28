# ADR-001：Internal Executor Contract

- Status: Draft
- Date: 2026-03-27
- Owners: AgentCore OS core
- Related backlog:
  - `Converge on an internal executor core`
- Related docs:
  - `docs/NEXT_STEPS.md`
  - `docs/EXECUTOR_CONVERGENCE.zh-CN.md`

## Context

AgentCore OS 已经不是单纯的 UI shell。当前系统已经具备：

- 本地优先工作台
- browser / desktop / sidecar 多运行形态
- OpenClaw / LLM / publish API
- 初步落地的 executor core 与 session store

但当前执行层仍存在明显的语义分裂风险：

1. 同一个任务会从不同入口进入系统  
   例如 `src/app/api/openclaw/agent/route.ts`、runtime 相关 API、桌面 sidecar 路径，以及部分直接依赖 OpenClaw 的 server route。

2. 前端构造的上下文不是所有链路都以同样方式消费  
   目前前端会传递 `message / sessionId / systemPrompt / useSkills / workspaceContext / llm`，但并不是所有路径都落到统一 contract 上。

3. session 目前已经被产品广泛使用，但内部会话能力仍然很薄  
   当前已经有 `executor-session-store`，但仍更接近执行历史日志，而不是完整的 session ownership。

4. `useSkills` 目前仍偏提示层开关，不是可审计、可调度、可失败隔离的 skill policy

5. 外部运行时和兼容路径仍可能影响主执行语义  
   如果主链路仍以某个外部程序或历史 API 形状为中心，系统很难获得稳定、精准、可替换的执行内核。

当前仓库已经有了第一步实现：

- `src/lib/executor/core.ts`
- `src/lib/server/executor-runner.ts`
- `src/lib/server/executor-session-store.ts`
- `src/app/api/openclaw/agent/route.ts`

但这些实现还不足以构成最终稳定契约，仍需要 ADR 级别的统一决策来约束后续设计和重构。

## Decision

AgentCore OS 决定采用一套由系统自己定义和维护的内部执行契约，作为所有任务执行入口的唯一官方 contract。

### 1. 单一官方任务契约

系统内部官方任务契约统一为：

- `taskInput`
- `session`
- `context`
- `skillPolicy`
- `modelConfig`
- `executionPolicy`
- `result`
- `trace`

在当前阶段，可保留与现有实现兼容的字段命名，但语义上应收敛为上述八类对象。

当前兼容映射关系如下：

- `message` -> `taskInput.userMessage`
- `sessionId` -> `session.id`
- `systemPrompt` -> `context.systemPrompt`
- `workspaceContext` -> `context.workspace`
- `useSkills` -> `skillPolicy.enabled`
- `llm` -> `modelConfig`
- `timeoutSeconds` -> `executionPolicy.timeoutSeconds`

### 2. 所有执行入口必须先进入 executor core

以下入口必须以 facade 或 adapter 身份存在，最终统一转调内部 executor core：

- `/api/openclaw/agent`
- runtime-facing API entrypoints
- 桌面 sidecar 对应执行入口
- 后续新的 agent/task execution 路径

不允许每条 API 路径各自维护一套请求语义、会话处理和结果映射逻辑。

### 3. Session ownership 归 AgentCore OS

系统自己负责 session 的核心语义，而不是把 session 真源交给外部程序或兼容层。

当前阶段，session 至少需要支持：

- 稳定的 `session.id`
- 输入输出历史
- system prompt 与 workspace context 记录
- engine / provider / model / duration / error 的可审计记录

后续阶段再逐步扩展：

- session summary
- continuation / resume
- cross-workflow session linkage
- session archive / retention policy

### 4. Skill policy 是系统策略，不是 prompt 注释

`useSkills` 不再被视为“是否给模型加一段技能提示”。

系统语义上采用 `skillPolicy`：

- 是否启用技能
- 可用技能范围
- 是否允许 planner 选择技能
- 失败时如何降级

第一阶段即使底层实现仍较轻，也必须保持这个语义方向，避免把临时开关继续固化成长期接口。

### 5. 外部运行时只作为 adapter，不作为主语义来源

OpenClaw CLI、历史 runtime route、未来其他执行后端，都只允许扮演以下角色：

- model adapter
- compatibility adapter
- optional tool backend

它们不允许成为：

- session source of truth
- skill policy source of truth
- official task contract 定义者

### 6. Trace 是正式输出的一部分

从本 ADR 开始，trace 不再是可有可无的日志附属品，而是执行 contract 的正式组成部分。

即使第一阶段只记录最小 trace，系统也必须明确以下字段属于 trace 范围：

- request source
- engine
- provider / model
- startedAt / duration
- success / error
- session linkage

后续若扩展 skill runner、tool execution、artifact generation，也应继续落在 trace 模型内，而不是再造平行日志体系。

## Alternatives Considered

### 方案 A：继续沿用 `openclaw` 风格请求体，逐步打补丁

不采纳。

原因：

- 这种方式短期改动小，但会持续放大历史命名和历史语义对主系统的绑架
- `message / sessionId / useSkills` 这一层表达力不够，难以承载后续 session、policy、trace 扩展
- 不利于把 OpenClaw 从主语义降级为兼容层

### 方案 B：让不同运行形态各自保留执行协议，靠 adapter 做双向转换

不采纳。

原因：

- 会继续制造 browser / server / sidecar 语义漂移
- 测试复杂度和排障复杂度会快速增大
- 后续每加一个入口就要复制一遍转换和回归逻辑

### 方案 C：一步到位设计完整 agent framework，包括 planner、skill runtime、artifact system

当前不采纳。

原因：

- 目标过大，会阻塞当前主线交付
- 当前最重要的是先收敛官方 contract，而不是一次性把整套运行时做完
- 可以先定义 contract，再逐步把 planner、skill runtime 和 artifacts 填进去

## Consequences

### 正向结果

1. 执行语义更稳定  
   不同运行形态下，同一任务将共享统一 contract 和统一核心执行入口。

2. session 能力会逐步从“历史日志”升级为“系统自有能力”

3. skill、model、context、trace 的边界会更清晰  
   后续做 AI usefulness、workflow handoff、observability 都会更容易。

4. 外部运行时将更容易替换  
   OpenClaw、未来 provider、其他 adapter 的替换成本会下降。

### 成本与约束

1. 现有 API 命名会出现“兼容字段”和“目标语义”并存的过渡期

2. 需要补充 mapping 层和 contract 文档  
   否则实现会再次回到凭感觉扩字段。

3. 需要为 session store、executor route、wrapper API 增加测试  
   否则 contract 只停留在文档层。

## Rollout

### Phase 1：Contract freeze

目标：

- 固定官方 contract 语义
- 保留现有请求字段作为 compatibility facade

动作：

- 在 `src/lib/executor/*` 明确 contract 类型
- 给 `/api/openclaw/agent` 增加 request mapping 层
- 明确 `trace` 最小字段集
- 在文档中固定兼容映射

完成标准：

- 所有新执行入口必须先映射到官方 contract
- 不再新增绕过 executor core 的主执行 API

### Phase 2：Session strengthening

目标：

- 把 session store 从“执行日志”提升为“系统会话层”

动作：

- 增加 session metadata
- 增加 resume / summary 所需字段预留
- 统一 session record 与 route contract

完成标准：

- 前端和 API 都可读取统一 session 视图
- session 不再依赖外部程序内部格式

### Phase 3：Skill policy and trace enrichment

目标：

- 让 skill policy 与 trace 成为真正可扩展的 contract 组成部分

动作：

- 将 `useSkills` 迁移为 `skillPolicy`
- 为 planner / runner / fallback 预留 trace 结构
- 为后续 tool / artifact 扩展保留字段

完成标准：

- skill 相关字段不再只是布尔开关
- trace 能覆盖主要执行路径和失败点

## Open Questions

1. 官方 contract 类型是否在第一阶段就引入 `taskInput` 嵌套对象，还是先保持扁平字段并通过类型别名收敛语义？
2. session store 的 durable 形态是否继续先使用 JSON store，还是尽早为 SQLite/更稳的本地存储预留接口？
3. publish、creative-studio、vault query 这类当前仍部分直接依赖 OpenClaw 的路径，何时进入统一 executor facade？
4. trace 是否在 API 响应中直接返回最小摘要，还是先只内部持久化？

## Non-Goals

本 ADR 当前不解决以下问题：

- 完整的 skill planner / skill runner 实现
- 完整的 artifact storage 体系
- provider 级高级调度策略
- 分布式执行与远程队列系统

这些内容应在本 contract 稳定后，按后续 ADR 继续推进。

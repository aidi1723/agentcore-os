# AgentCore OS 技术 ADR 清单

本文把当前 `NEXT_STEPS` 中最值得尽快固化的技术决策，整理成一组 ADR backlog。

目标不是一次性写完所有 ADR，而是让团队明确：

- 哪些决策已经到了必须被写清楚的阶段
- 每份 ADR 解决什么问题
- 每份 ADR 应服务哪个 backlog 项
- 每份 ADR 的最小产出应该是什么

## 使用原则

- ADR 只记录关键技术决策，不记录普通实现细节
- ADR 要服务真实工程分歧、风险或长期约束
- ADR 要能帮助后续实现、测试、重构和新成员理解系统

## 优先级说明

- `P0`：建议立即进入排期
- `P1`：P0 推进后尽快补齐
- `P2`：有实现信号后再写

## P0

### ADR-001：Internal Executor Contract

文档：

- [ADR-001：Internal Executor Contract](adr/ADR-001-INTERNAL_EXECUTOR_CONTRACT.zh-CN.md)

对应 backlog：

- `Converge on an internal executor core`

要解决的问题：

- browser / server / sidecar 当前执行语义分裂
- session ownership、context、skill policy、result、trace 缺少统一契约
- OpenClaw 和未来 runtime adapter 的边界不够清晰

建议覆盖内容：

- executor input model
- session model
- workspace context model
- skill / tool policy
- result / error / trace model
- adapter boundary

最低产出：

- 一份统一输入输出 contract
- 一张运行时边界图
- 一份 error surface 说明

### ADR-002：Workflow State And Handoff Model

文档：

- [ADR-002：Workflow State And Handoff Model](adr/ADR-002-WORKFLOW_STATE_AND_HANDOFF_MODEL.zh-CN.md)

对应 backlog：

- `Deepen the sales hero workflow`
- `Make the content workflow actually compound`
- `Make scenario packs runnable, not just installable`

要解决的问题：

- app-to-app handoff 目前仍偏事件驱动和局部上下文拼接
- workflow run、stage、next step、retained asset 需要统一模型
- “流程完成了什么”“下一步是什么”还不够标准

建议覆盖内容：

- workflow run state model
- stage transition rules
- handoff payload contract
- next-step suggestion shape
- completion markers
- asset write-back rule

最低产出：

- workflow state machine 图
- handoff payload schema
- next-step / completion 字段定义

### ADR-003：Durable State Partitioning

文档：

- [ADR-003：Durable State Partitioning](adr/ADR-003-DURABLE_STATE_PARTITIONING.zh-CN.md)
- [状态盘点](STATE_INVENTORY.zh-CN.md)

对应 backlog：

- `Make the content workflow actually compound`
- `Make scenario packs runnable, not just installable`
- `Add a minimum regression test layer`

要解决的问题：

- 当前大量状态仍在 `localStorage`
- UI transient state、workflow state、asset state、execution state 没有清晰分层
- 后续 durable persistence 迁移容易发生边界混乱

建议覆盖内容：

- 状态分层原则
- 哪些状态继续 local-first
- 哪些状态应迁移到 durable store
- 跨窗口 / 跨桌面 / 跨服务端同步策略
- migration strategy

最低产出：

- state inventory
- durable vs transient 划分表
- 迁移顺序建议

### ADR-004：Publish Job Lifecycle And Retry Policy

文档：

- [ADR-004：Publish Job Lifecycle And Retry Policy](adr/ADR-004-PUBLISH_JOB_LIFECYCLE_AND_RETRY_POLICY.zh-CN.md)

对应 backlog：

- `Make the publish flow reliable enough to support automation`

要解决的问题：

- publish queue 已进入后台 worker、锁、重试、退避问题域
- 当前 job lifecycle、idempotency、error classification 需要更明确
- 浏览器和后台 worker 的职责边界需要固定

建议覆盖内容：

- job states
- retry policy
- backoff policy
- idempotency rule
- lock strategy
- receipt persistence
- browser vs worker responsibility split

最低产出：

- job lifecycle 图
- retry / backoff 表
- receipt 与 error 分类说明

### ADR-005：Connector Boundary And Trust Model

文档：

- [ADR-005：Connector Boundary And Trust Model](adr/ADR-005-CONNECTOR_BOUNDARY_AND_TRUST_MODEL.zh-CN.md)

对应 backlog：

- `Make the publish flow reliable enough to support automation`
- connector / sidecar 相关能力扩展

要解决的问题：

- connector 是外部执行边界，但信任、错误解释、回执形状还不够标准
- 本地 connector、webhook connector、future adapter 的契约需要统一

建议覆盖内容：

- connector request / response contract
- auth and token handling
- health check contract
- receipt contract
- timeout / retry ownership
- trust boundary

最低产出：

- connector contract 文档
- trust boundary 图
- health / receipt schema

## P1

### ADR-006：Knowledge Vault Retrieval Model

对应 backlog：

- `Research workflow`
- `Knowledge Vault`
- `Add useful AI assistance inside the existing workflows`

要解决的问题：

- 资产当前更像本地列表，不是真正的 retrieval layer
- 后续需要支持跨场景召回、过滤、复用统计和下一步动作支持

建议覆盖内容：

- asset schema
- metadata model
- keyword retrieval
- vector / hybrid retrieval strategy
- ranking signals
- reuse feedback loop

最低产出：

- retrieval architecture 草案
- asset metadata schema
- ranking / reuse signals 列表

### ADR-007：Scenario Pack Prefill Contract

对应 backlog：

- `Make scenario packs runnable, not just installable`

要解决的问题：

- playbook 当前更偏打开 app，而不是预填真实状态
- scenario pack 如何驱动可执行流程需要标准化

建议覆盖内容：

- playbook prefill payload
- target app mapping
- next-step cues
- completion markers
- failure fallback

最低产出：

- prefill payload schema
- app mapping 规范
- scenario execution contract

### ADR-008：Structured Output And Recommendation Contract

文档：

- [ADR-008：Structured Output And Recommendation Contract](adr/ADR-008-STRUCTURED_OUTPUT_AND_RECOMMENDATION_CONTRACT.zh-CN.md)

对应 backlog：

- `Add useful AI assistance inside the existing workflows`

要解决的问题：

- AI 输出现在仍有较强自由文本色彩
- 要从“生成文本”走向“建议下一步动作”和“可被工作流消费的结果”

建议覆盖内容：

- structured output schema
- action recommendation model
- confidence / fallback rule
- app consumption contract

最低产出：

- output schema
- action recommendation 字段定义
- fallback 处理规则

### ADR-009：Regression Test Coverage Strategy

对应 backlog：

- `Add a minimum regression test layer`

要解决的问题：

- 当前需要明确哪些层必须被自动化回归覆盖
- 存储、API、workflow、desktop shell 的门禁粒度需要清晰

建议覆盖内容：

- test pyramid
- storage/state helper coverage
- API test boundary
- browser smoke scope
- desktop / sidecar smoke scope

最低产出：

- regression coverage map
- test ownership 边界
- release gate 建议

## P2

### ADR-010：Local-First Sync And Conflict Strategy

对应 backlog：

- durable persistence 演进
- browser / desktop / server 协同增强

要解决的问题：

- 后续一旦状态开始跨运行时流转，就会出现同步和冲突问题

建议覆盖内容：

- sync ownership
- merge rule
- conflict policy
- offline recovery

最低产出：

- sync strategy 草案
- conflict resolution rule

### ADR-011：Containerized Execution Boundary

对应 backlog：

- connector / worker / sidecar 的进一步隔离与运行控制

要解决的问题：

- 哪些执行单元值得容器化
- 哪些只需进程级隔离
- 最小权限和资源上限如何定义

建议覆盖内容：

- container candidate list
- process vs container decision rule
- secrets / volume / network boundary
- resource limit policy

最低产出：

- execution boundary matrix
- containerization criteria

## 推荐的起步顺序

如果只先写四份，建议顺序是：

1. ADR-001 Internal Executor Contract
2. ADR-004 Publish Job Lifecycle And Retry Policy
3. ADR-003 Durable State Partitioning
4. ADR-006 Knowledge Vault Retrieval Model

理由：

- 它们分别对应 execution convergence、publish reliability、state evolution、knowledge reuse
- 这四项最容易直接影响未来 3 到 6 个月的主线交付

## 推荐的 ADR 模板

每份 ADR 建议至少包含以下结构：

1. Context
2. Decision
3. Alternatives considered
4. Consequences
5. Open questions
6. Rollout / migration notes

## 结论

对 AgentCore OS 来说，ADR 不是为了“文档完备感”，而是为了给接下来的 executor、workflow、persistence、publish、connector 这些关键技术面留下一致、可复用、可审计的决策记录。

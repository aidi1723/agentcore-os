# ADR-003：Durable State Partitioning

- Status: Draft
- Date: 2026-03-27
- Owners: AgentCore OS core
- Related backlog:
  - `Make the content workflow actually compound`
  - `Make scenario packs runnable, not just installable`
  - `Add a minimum regression test layer`
- Related docs:
  - `docs/NEXT_STEPS.md`
  - `docs/STATE_INVENTORY.zh-CN.md`

## Context

AgentCore OS 当前状态层已经进入“多模型并存”阶段，不再只是简单的浏览器本地存储：

1. 仍有大量状态直接存于 `localStorage`  
   包括草稿、任务、知识资产、研究资产、创作资产、各类业务应用记录，以及部分 UI 状态和会话列表。

2. 已经出现 hybrid state 模型  
   `deals`、`support tickets`、`workflow-runs` 已使用 `createServerBackedListState(...)`，形成“浏览器本地缓存 + runtime API + server JSON store + tombstone”的形态。

3. 已经存在 server-durable 状态  
   例如：
   - publish jobs
   - executor sessions
   - workflow run store
   - deal store
   - support ticket store

4. 不同类型状态的生命周期并不相同  
   目前最大的问题不是“状态都在 localStorage”，而是：

- UI transient state、workflow state、asset state、execution state 仍缺少清晰分层
- 哪些状态只是本机体验缓存，哪些状态必须 durable，没有统一原则
- 后续从 localStorage 迁移到 durable store 时，容易把不该升级的 UI 状态一起复杂化，也容易把真正关键的 workflow/asset 状态继续留在浏览器里

当前项目已经显露出三个现实压力：

1. workflow handoff 需要稳定可追踪的状态  
   如果草稿、资产、运行记录只存在浏览器里，跨窗口、跨桌面壳、跨运行时的连贯性会变弱。

2. session / execution 语义已开始收敛  
   executor contract 正在变成系统正式能力，执行状态不能再与普通 UI 状态混在一层。

3. 测试门禁需要稳定的状态边界  
   如果 durable state 和 transient state 没有清晰分层，回归测试就很难明确覆盖哪些状态与行为。

## Decision

AgentCore OS 采用四层状态分区模型，作为当前和后续 durable persistence 演进的官方边界。

### 1. Class A：UI Transient State

定义：

- 只服务当前设备上的显示、布局、偏好和临时交互体验
- 丢失后不影响业务资产、workflow continuity 或执行审计

典型例子：

- 窗口几何信息
- sidebar 宽度与折叠状态
- onboarding / welcome dismiss flags
- Spotlight history
- 纯前端 agent sidebar 展示态

存储决策：

- 允许继续使用 `localStorage`
- 不进入 durable store
- 不要求跨设备、跨运行时同步

### 2. Class B：Local-First Working Cache

定义：

- 是业务工作中会被频繁编辑和复用的数据
- 对用户有价值，但暂时仍允许以本机优先缓存存在
- 后续可能升级为 durable domain state

典型例子：

- drafts
- knowledge assets
- creator assets
- research assets
- sales assets
- support assets
- tasks / inbox / briefs / notes 等个人工作台数据

存储决策：

- 当前允许 local-first 存放
- 但不得再被视为长期最终形态
- 所有这类状态都必须逐步进入 durable migration backlog

### 3. Class C：Durable Domain State

定义：

- 直接驱动业务 workflow、跨应用 handoff、资产复用或场景闭环
- 丢失后会影响流程 continuity、业务可追踪性或团队信任

典型例子：

- deals
- support tickets
- workflow runs
- 后续需要 durable 的 drafts / knowledge assets / playbook execution state

存储决策：

- 必须有 durable source of truth
- 浏览器本地只能作为缓存或离线缓冲层
- 当前阶段优先采用“server-backed local-first”模式承接迁移

### 4. Class D：Execution And Audit State

定义：

- 执行链路、后台任务、审计、回执、错误排查所依赖的状态
- 需要最强的可追踪性和持久化要求

典型例子：

- publish jobs
- executor sessions
- publish receipts / retry metadata
- future traces / artifacts metadata

存储决策：

- 必须 durable
- 不允许只存在浏览器
- 浏览器若持有，仅作为只读缓存或短期镜像

## Partitioning Rules

### 规则 1：凡是参与 workflow handoff 的状态，不能长期停留在 Class A

如果某条数据会决定：

- 下一步该做什么
- 哪个 app 接手
- 哪个资产被保留
- 哪个 workflow run 继续推进

那么它至少应属于 Class B，通常最终应进入 Class C。

### 规则 2：凡是参与执行审计的状态，必须进入 Class D

如果某条数据用于：

- 重试
- 恢复
- 回执
- 错误解释
- 运行追踪

则不能只放在浏览器本地。

### 规则 3：浏览器本地可以做缓存，但不应再默认为真源

对 Class C / D 状态：

- `localStorage` 可以继续存在
- 但只能是 cache、offline buffer 或 hydration source
- 不能再被当作唯一 source of truth

### 规则 4：设置是特殊状态，按子类拆分

`settings` 不能被当成单一类型状态处理。

需要拆成至少两类：

- 设备与 UI 偏好
- 凭证、引擎与运行时配置

决策：

- 设备与 UI 偏好可保持 local-first
- 凭证与运行时配置应走 desktop bridge / secure local store / server-managed path，而不是简单复制到通用 durable domain store

### 规则 5：server-backed list state 是当前阶段的标准迁移桥

对从 localStorage 迁往 durable store 的 domain state，当前优先采用：

- local cache
- runtime API
- server JSON store
- tombstone / retry / rehydrate

这不是最终形态，但它是当前阶段最现实、最稳妥的中间层。

## Alternatives Considered

### 方案 A：继续维持“能放 localStorage 就先放 localStorage”

不采纳。

原因：

- 会继续模糊 UI 状态、业务状态、执行状态之间的边界
- workflow continuity 和测试边界都会越来越脆弱
- 后续迁移会演变成大面积、无优先级的重构

### 方案 B：立即把所有状态都迁移到统一 durable store

当前不采纳。

原因：

- 成本过大，会阻塞当前主线交付
- 很多 UI transient state 根本不值得 durable 化
- settings 中的凭证和运行时配置也不适合简单归到通用业务存储

### 方案 C：仅靠 server-backed list state 解决所有状态问题

不采纳。

原因：

- 这只是迁移桥，不是最终普适模型
- execution/audit state 与 domain list state 并不完全同构
- settings、session、artifacts 等状态需要自己的存储边界

## Consequences

### 正向结果

1. 后续迁移将有明确优先级  
   不再是“看哪个文件顺手就先迁哪个”。

2. workflow 与 execution 相关状态会更稳  
   这会直接提升 publish、sales、support、research 等闭环的可靠性。

3. 测试范围会更清晰  
   Class C / D 状态应优先进入 regression coverage。

4. UI 状态不会被过度工程化  
   纯设备本地体验仍可保持轻量。

### 成本与约束

1. 短期内会出现 mixed model  
   一部分状态继续 local-only，一部分已经 hybrid，一部分已 durable。

2. 需要维护 state inventory  
   否则团队会重新失去边界感。

3. durable migration 需要按批次推进  
   不能一次性改完所有应用状态。

## Rollout

### Phase 1：Freeze classification

目标：

- 先固定状态分类与优先级

动作：

- 建立 state inventory
- 给现有状态打上 A / B / C / D 标签
- 明确 settings 的拆分策略

完成标准：

- 新增状态模块时，必须先声明所属分类
- ADR 与 inventory 成为评审依据

### Phase 2：Expand durable domain state

目标：

- 把最关键的 workflow / asset 状态从 local-only 迁到 hybrid / durable

第一批建议对象：

- drafts
- knowledge assets
- sales assets
- support assets
- creator assets
- research assets

完成标准：

- 上述状态至少进入“local cache + runtime sync + server store”模式

### Phase 3：Separate execution/audit state further

目标：

- 让 Class D 状态从普通业务状态中彻底分离

动作：

- 完善 publish jobs / receipts 的 durable 语义
- 完善 executor sessions / traces 的 durable 语义
- 为 future artifact metadata 预留独立边界

完成标准：

- execution/audit state 不再依赖浏览器持久化

## Recommended Migration Order

建议迁移顺序：

1. drafts
2. knowledge assets
3. sales assets / support assets
4. creator assets / research assets
5. tasks / inbox / briefs / notes
6. settings 拆分后分别处理

排序依据：

- 是否直接影响 workflow handoff
- 是否直接影响资产复用
- 是否直接影响执行连续性
- 是否涉及凭证与安全边界

## Open Questions

1. drafts 与 knowledge assets 是否应共用一套 server-backed asset store，还是保持分库但统一 contract？
2. settings 中 API keys、desktop runtime config 是否需要独立 secure storage 层？
3. agent sidebar 的本地会话与 executor session 何时合流，或者是否应该明确分离为“UI chat state”与“execution session”？
4. durable domain state 的下一阶段是否直接进入 SQLite 抽象，而不是继续 JSON store？

## Non-Goals

本 ADR 当前不解决：

- 最终数据库选型
- 多设备同步协议
- 冲突解决算法的完整细节
- 凭证安全存储的最终实现

这些内容应在后续 ADR 中单独固化。

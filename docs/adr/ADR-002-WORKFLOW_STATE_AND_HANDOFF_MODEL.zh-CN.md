# ADR-002：Workflow State And Handoff Model

- Status: Draft
- Date: 2026-03-28
- Owners: AgentCore OS core
- Related backlog:
  - `Deepen the sales hero workflow`
  - `Make the content workflow actually compound`
  - `Make scenario packs runnable, not just installable`
- Related docs:
  - `docs/NEXT_STEPS.md`
  - `docs/TECH_ADR_BACKLOG.zh-CN.md`
  - `docs/adr/ADR-003-DURABLE_STATE_PARTITIONING.zh-CN.md`

## Context

AgentCore OS 现在已经不是“点开几个 App，各自做一点事”的状态了。

仓库里已经存在三类真实能力：

1. workflow run 已经有正式记录层  
   `src/lib/workflow-runs.ts` 已定义：
   - `WorkflowRunRecord`
   - `WorkflowRunState`
   - `WorkflowStageRunState`
   - `start / advance / awaiting_human / complete / fail`

2. scenario 已经把 stage 拆成显式结构  
   `src/lib/workspace-presets.ts` 已定义每条 workflow 的：
   - stage id
   - stage mode
   - stage app mapping
   - result asset

3. app-to-app handoff 已经不再只是临时文本  
   当前已有：
   - `WorkflowContextMeta`
   - `SalesWorkflowMeta`
   - `CreatorWorkflowMeta`
   - `ui-events.ts` 中的 prefill contract
   - `drafts / creator-assets / sales-assets / support-assets / research-assets` 的 retained state

尤其在 creator 链路里，Radar -> Repurposer -> Publisher -> creator asset 的 handoff 已经形成真正的闭环：

- 来源应用、来源记录 ID、来源摘要会继续传递
- 目标受众、主打角度、block label、建议平台、发布备注会继续传递
- 发布回执与复用笔记会写回 creator asset

但当前仍存在一个问题：

- handoff 语义分散在各个 app 的 prefill 和本地 patch 里
- workflow run、stage state、next step、completion marker 还没有被正式写成统一模型
- “什么时候算进入下一阶段”“什么时候算真正完成”“哪些字段必须跟着 handoff 走” 仍容易漂移

如果不把这套模型固化下来，后续 sales、creator、scenario packs 都会继续演化出各自的隐式规则。

## Decision

AgentCore OS 正式采用“workflow run 作为运行时主线，handoff payload 作为跨应用上下文契约，retained asset 作为闭环落点”的三层模型。

### 1. Workflow run 是官方运行时状态

每条 hero workflow 在运行时都必须能映射到一条 `WorkflowRunRecord`。

官方字段如下：

```ts
type WorkflowRunRecord = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  triggerType: "manual" | "schedule" | "inbound_message" | "web_form";
  state: "idle" | "running" | "awaiting_human" | "completed" | "error";
  currentStageId?: string;
  stageRuns: Array<{
    id: string;
    title: string;
    mode: "auto" | "assist" | "review" | "manual";
    state: "pending" | "running" | "awaiting_human" | "completed" | "error";
  }>;
  createdAt: number;
  updatedAt: number;
};
```

职责边界：

- `workflow-runs` 负责回答“这条链现在跑到哪一步了”
- 它不负责保存完整业务内容正文
- 具体业务内容应继续沉淀到 drafts、assets、domain records

### 2. 官方状态集合固定，不再按场景各自发明

当前阶段的 run state 固定为：

- `idle`
- `running`
- `awaiting_human`
- `completed`
- `error`

当前阶段的 stage state 固定为：

- `pending`
- `running`
- `awaiting_human`
- `completed`
- `error`

语义如下：

- `idle`：尚未真正开始运行
- `running`：当前 stage 正在推进，且不等待人工确认
- `awaiting_human`：当前 stage 需要人工 review、确认或手动操作
- `completed`：整条 workflow 已完成，并已离开当前 stage
- `error`：当前 run 进入异常，需要人工判断是否重启或另起一轮

### 3. Stage transition 采用显式推进规则

标准转移规则如下：

```text
startWorkflowRun
  -> first stage = running | awaiting_human

advanceWorkflowRun
  -> current stage = completed
  -> next stage = running | awaiting_human
  -> no next stage => run.state = completed

setWorkflowRunAwaitingHuman
  -> current stage = awaiting_human
  -> run.state = awaiting_human

completeWorkflowRun
  -> all stages = completed
  -> currentStageId = undefined
  -> run.state = completed

failWorkflowRun
  -> current stage = error
  -> run.state = error
```

补充规则：

1. stage mode 决定默认进入 `running` 还是 `awaiting_human`  
   `review` 与 `manual` 默认进入 `awaiting_human`；`auto` 与 `assist` 默认进入 `running`。

2. `awaiting_human` 不是失败，也不是暂停  
   它表示系统正在等待人工做一个有意义的接力动作，例如：
   - 选择最终版本
   - 确认是否发布
   - 决定是否写回资产

3. `completed` 必须代表整个 scenario 级链路结束  
   不能把“某个 app 完成了自己的局部动作”误记为整个 workflow completed。

### 4. Handoff payload 统一采用“基础上下文 + 场景扩展”

所有跨应用 handoff 都必须先带上基础 workflow context：

```ts
type WorkflowContextMeta = {
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: WorkflowTriggerType;
};
```

规则：

- `workflowRunId`：把不同 app 的动作归到同一轮 workflow
- `workflowScenarioId`：说明它属于哪条 hero workflow
- `workflowStageId`：说明 handoff 从哪一阶段发出
- `workflowSource`：给人看的来源说明，不是机器主键
- `workflowNextStep`：给下一个 app / 操作者的明确动作提示
- `workflowTriggerType`：保留触发上下文，支持 manual / schedule / inbound

在此基础上，各场景可扩展自己的 domain-specific handoff 字段。

creator workflow 当前正式扩展为：

```ts
type CreatorWorkflowMeta = WorkflowContextMeta & {
  workflowOriginApp?: "creator_radar" | "content_repurposer" | "publisher";
  workflowOriginId?: string;
  workflowOriginLabel?: string;
  workflowAudience?: string;
  workflowPrimaryAngle?: string;
  workflowSourceSummary?: string;
  workflowBlockLabel?: string;
  workflowSuggestedPlatforms?: PublishPlatformId[];
  workflowPublishNotes?: string;
};
```

这些字段的官方意义如下：

- `workflowOriginApp / workflowOriginId / workflowOriginLabel`
  - 标识 handoff 的上一个业务节点
  - 让下游 app 知道该回跳到哪条记录
- `workflowAudience`
  - 目标受众，不再靠自由文本重复描述
- `workflowPrimaryAngle`
  - 本轮内容核心角度，后续改写不应偏题
- `workflowSourceSummary`
  - 上游提炼出的最短摘要，避免每次重新读长内容
- `workflowBlockLabel`
  - 当前被选中的 block / version label
- `workflowSuggestedPlatforms`
  - 下游 app 预期适配的平台集合
- `workflowPublishNotes`
  - 发布条件、操作员提示或渠道备注

### 5. Handoff contract 必须进入三种载体

一条有效 handoff 不能只停留在浏览器事件瞬间。

至少应进入以下三个载体中的两个，通常应进入全部三个：

1. app open / prefill payload  
   用于把上下文交给下一个 app。

2. retained working artifact  
   例如：
   - draft
   - creator asset
   - sales asset
   - support asset
   - research asset

3. workflow run UI state  
   用于展示当前链路处于哪个 stage、下一步该做什么。

当前 creator 链的落点规则已经明确：

- Radar -> Repurposer：prefill 传递来源、受众、主打角度、来源摘要
- Repurposer -> Publisher：prefill 继续传递 block label、建议平台、发布备注
- Publisher -> Draft / Creator Asset：把 handoff context 与最新稿件、发布结果一起写入 retained state

### 6. `workflowNextStep` 是官方下一步字段

所有 handoff 都应尽量产出一个面向人的“下一步”说明，并使用 `workflowNextStep` 传递。

要求：

- 必须是动作句，而不是抽象标签
- 必须能在下游 app 中直接指导操作
- 必须与当前 stage 对齐

可接受示例：

- “把摘要送到 Content Repurposer，生成多平台内容包。”
- “在 Publisher 里做标题、CTA 和平台适配检查。”
- “等待 connector 回执补齐，再确认哪些结构值得继续复用。”

不可接受示例：

- “下一步处理一下”
- “继续工作流”
- “content workflow”

### 7. Completion marker 采用“双重确认”

Workflow completion 不能只依赖 UI 按钮，也不能只依赖 asset patch。

当前阶段官方 completion marker 为：

1. `workflowRun.state = completed`
2. `currentStageId = undefined`
3. retained asset 已写入本轮最终 `nextAction / status / reuseNotes` 等闭环结果

这三者中，`workflowRun.state = completed` 是唯一官方“流程结束”信号。

补充规则：

- 允许在 `run.state !== completed` 时先写入中间资产  
  例如 creator publish loop 里，selected job feedback 可以先把 creator asset 写成 `status = publishing`。

- 不允许把“已有 publish receipt”自动视为整轮 workflow 完成  
  creator 当前明确保持 human-controlled completion：
  - job feedback 可自动回写
  - `completeCreatorWorkflowRun()` 仍需显式调用

### 8. Asset write-back 采用“同一 workflowRunId 持续累积”

retained asset 的官方写回规则：

1. 同一轮 workflow 优先使用同一 `workflowRunId` 聚合  
   不让每个 stage 都产出互不相认的新资产。

2. 各 stage 可以逐步 enrich，而不是等最后一步一次性写入  
   例如 creator asset 可依次累积：
   - topic
   - audience
   - primaryAngle
   - latestDigest
   - latestPack
   - latestDraftTitle / latestDraftBody
   - publishTargets
   - publishStatus
   - reuseNotes

3. 最终闭环时应以“更新已有资产”为主，而不是新建平行副本  
   这样 asset console 才能真正展示一条持续生长的记录。

## Alternatives Considered

### 方案 A：继续保持纯事件驱动 handoff

不采纳。

原因：

- 事件瞬间无法承担 durable workflow continuity
- 很难解释“当前 run 到哪了”
- 很难把下一步、完成状态和 retained asset 绑定到同一轮上下文

### 方案 B：先做一个重型中央编排器，再统一所有 handoff

当前不采纳。

原因：

- 当前仓库主线仍是本地优先工作台与闭环 workflow，而不是自研 orchestration runtime
- 现有 `workflow-runs + prefill + retained assets` 已足够支撑下一阶段演进
- 先冻结 contract，比先引入更重执行层更现实

### 方案 C：每个场景自己维护一套 handoff 字段

不采纳。

原因：

- 会导致 sales / creator / support / research 各自演化出不兼容 payload
- scenario packs 无法稳定映射到可执行 workflow
- regression test 难以形成统一门禁

## Consequences

### 正向结果

1. workflow continuity 更可解释  
   任何 app 都能回答“这条链来自哪里、现在在哪一步、下一步要做什么”。

2. retained asset 真正成为闭环层  
   不再只是本地列表，而是 workflow result 的正式承接点。

3. scenario pack 更容易 runnable  
   因为可执行上下文已经有稳定 payload 形状。

4. regression coverage 更容易落地  
   handoff 和 state transition 都可以按 contract 测。

### 成本与约束

1. prefill schema 需要持续维护  
   新增场景字段时，要同时更新 UI contract、持久化和测试。

2. `workflowNextStep` 需要工程纪律  
   否则很快又会退化成模糊文案。

3. retained asset 与 workflow run 需要保持同步  
   不能只更新一个而忘了另一个。

## Current Rollout

### Phase 1：Freeze generic workflow model

已完成：

- `workflow-runs.ts` 已形成统一 run / stage state 模型
- `workspace-presets.ts` 已形成 stage mode 与 app mapping

### Phase 2：Close the creator workflow loop

已完成：

- `CreatorWorkflowMeta` 已扩展 origin / angle / summary / block / platform / notes
- `ui-events.ts` 中 creator handoff 已统一使用 richer workflow meta
- `drafts` 与 `draft-store` 已持久化 creator handoff context
- `Publisher` 已把 publish feedback 写回 creator asset

### Phase 3：Push the same contract into other workflows

下一步：

- sales / support / research 继续对齐基础 context model
- scenario packs 在 `ADR-007` 中继续补 runnable prefill contract

## Example: Creator Workflow Handoff

```text
Creator Radar
  -> handoff:
     workflowRunId
     workflowStageId = radar
     workflowOriginApp = creator_radar
     workflowAudience
     workflowPrimaryAngle
     workflowSourceSummary
     workflowNextStep = 把摘要送到 Content Repurposer，生成多平台内容包。

Content Repurposer
  -> handoff:
     workflowStageId = repurpose
     workflowOriginApp = content_repurposer
     workflowBlockLabel
     workflowSuggestedPlatforms
     workflowPublishNotes
     workflowNextStep = 在 Publisher 里做标题、CTA 和平台适配检查。

Publisher
  -> writes back:
     draft context
     creator asset latest draft
     publishStatus
     nextAction
     reuseNotes
  -> explicit completion:
     completeWorkflowRun(workflowRunId)
```

这个模型当前先以 creator workflow 为最完整样板，后续其他 hero workflow 应按同一原则收敛，而不是各自再发明一套状态机和 handoff 载体。

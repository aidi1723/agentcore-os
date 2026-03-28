# ADR-008：Structured Output And Recommendation Contract

- Status: Draft
- Date: 2026-03-28
- Owners: AgentCore OS core
- Related backlog:
  - `Add useful AI assistance inside the existing workflows`
- Related docs:
  - `docs/NEXT_STEPS.md`
  - `docs/TECH_ADR_BACKLOG.zh-CN.md`
  - `docs/adr/ADR-002-WORKFLOW_STATE_AND_HANDOFF_MODEL.zh-CN.md`

## Context

AgentCore OS 现在已经不再缺“能生成一段文本”的能力，真正缺的是：

- 哪些 AI 输出是给人看的解释
- 哪些 AI 输出应该变成下一步动作
- 哪些结果可以直接驱动 app jump、workflow resume、asset reuse

当前仓库里已经出现了多个 recommendation 雏形：

1. Publisher 有本地 recommendation 文案  
   `PublisherAppWindow.tsx` 会根据 publish readiness 给出“先预演 / 可发布”建议。

2. Knowledge Vault 已经开始返回结构化 mixed retrieval 结果  
   当前 `vault-mixed-query.ts` 与 `vault/query/route.ts` 已经产出：
   - ranked hits
   - recommended action
   - jump target

3. workflow handoff 已经有明确的 next-step contract  
   `ADR-002` 已经固定：
   - `workflowNextStep`
   - `workflowSource`
   - `jumpTarget` 背后的 app-to-app resume 语义

问题在于，这些能力目前还没有统一 contract：

- 不同 app 的 recommendation shape 仍然分散
- “命中结果”和“推荐动作”没有标准字段
- jump target、rationale、score、metadata 等结构还未正式收敛

如果不把这层 contract 固化下来，后续 sales、support、research、Knowledge Vault 都会各自长出一套 recommendation shape。

## Decision

AgentCore OS 正式采用“structured output + recommendation result”双层模型。

### 1. 自由文本仍然存在，但不再是唯一输出

AI / retrieval 类能力当前允许同时返回两类结果：

1. human-readable text  
   用于解释、总结、补充判断。

2. structured recommendation result  
   用于：
   - 渲染可点击结果
   - 恢复 workflow
   - 复用资产
   - 进入下一步 app

原则：

- 文本负责解释
- 结构负责执行

### 2. Recommendation result 采用统一 schema

当前官方 contract 如下：

```ts
type RecommendationHit = {
  kind: string;
  id: string;
  title: string;
  summary: string;
  score: number;
  rationale: string;
  metadata: string[];
  jumpTarget?: AssetJumpTarget;
};

type RecommendationSection = {
  id: string;
  label: string;
  hits: RecommendationHit[];
};

type RecommendationAction = {
  kind: string;
  label: string;
  rationale: string;
  jumpTarget?: AssetJumpTarget;
};

type RecommendationResult = {
  contractVersion: "v1";
  query: string;
  sections: RecommendationSection[];
  recommendedAction: RecommendationAction;
};
```

### 3. Hit model 固定回答“为什么是它”

`RecommendationHit` 的语义如下：

- `kind`
  - 告诉消费方它是什么类型结果
  - 例如：`file` / `knowledge_asset` / `creator_asset`

- `id`
  - 当前结果的稳定标识

- `title`
  - 人可读主标题

- `summary`
  - 一句话摘要，不等于完整正文

- `score`
  - 当前阶段的排序信号
  - 不承诺跨不同 feature 的绝对可比性

- `rationale`
  - 明确说明为什么命中
  - 这是当前阶段最重要的解释字段

- `metadata`
  - 可用于 UI badge、标签、补充上下文

- `jumpTarget`
  - 如果存在，说明该结果可以直接恢复到某个 app / record / draft

### 4. Recommendation action 固定回答“接下来做什么”

`RecommendationAction` 是 recommendation result 里的唯一主动作。

要求：

- 必须是单一主建议，不返回多个平级 primary CTA
- 必须说明原因
- 如果可以直接执行，应带 `jumpTarget`

当前典型 action kind：

- `review_file`
- `reuse_knowledge_asset`
- `resume_creator_workflow`
- `ask_for_context`

后续可以扩展，但必须保持：

- `label`
- `rationale`
- 可选 `jumpTarget`

### 5. Section model 用于跨来源聚合，而不是靠硬编码 UI 分支

`RecommendationSection` 的目的不是“做一个更复杂的列表”，而是：

- 让同一 recommendation result 同时容纳多个来源
- 避免 UI 写死 `matches.files / matches.creatorAssets / matches.knowledgeAssets`
- 允许后续加入：
  - `sales_assets`
  - `support_assets`
  - `research_assets`
  - `tasks`
  - `drafts`

规则：

- section 顺序由生成方决定
- UI 消费方默认按顺序渲染，不自己重排来源优先级

### 6. `jumpTarget` 是 structured recommendation 与 workflow handoff 的桥

本 ADR 不重新定义 jump 协议，而是复用现有 `AssetJumpTarget`。

这意味着：

- recommendation result 不需要重新发明 resume contract
- 如果某个命中或动作已可回跳，应直接带 `jumpTarget`
- 下游 UI 应优先调用统一 jump handler，而不是为每种结果单独写打开逻辑

### 7. 当前 contract 先由 local deterministic layer 生成，AI text 作为补充

当前阶段正式承认：

- `RecommendationResult` 可以由本地 deterministic helper 生成
- LLM 文本建议可以并行返回
- 两者不要求完全同源

原因：

- 结构化结果更需要稳定性和可测试性
- 自由文本更适合补充解释和人类沟通

当前 Knowledge Vault 已按此方向落地：

- local mixed query helper 生成 ranked hits + recommendedAction
- OpenClaw 返回自由文本建议
- UI 同时展示两者

当前同一 contract 也已经扩到更多面板：

- Publisher readiness recommendation
- Sales / Creator / Support / Research hero workflow panels
- Deal Desk / Support Copilot / Deep Research Hub 的主执行面板
- Content Repurposer / Inbox Declutter / Morning Brief 的主执行面板
- shared recommendation body UI
- runtime hero recommendation summary route
- shared runtime hero summary hook

## Alternatives Considered

### 方案 A：继续只返回自然语言

不采纳。

原因：

- 很难稳定驱动 UI 动作
- 很难形成 regression contract
- 每个 app 都要自己 parse 文本

### 方案 B：每个 app 自定义自己的 structured result

不采纳。

原因：

- 短期看灵活，长期会失去跨 workflow 一致性
- UI 和 tests 会被多套 shape 绑死

### 方案 C：强制所有 recommendation 都必须来自 LLM JSON 输出

当前不采纳。

原因：

- 稳定性和可测试性不足
- 很多本地规则更适合 deterministic 生成
- 当前主线不是模型编排，而是 workflow usefulness

## Consequences

### 正向结果

1. app-to-app recommendation shape 开始统一  
   不再每个 app 都发明自己的“建议对象”。

2. UI 更容易做可点击动作  
   因为 `jumpTarget` 和 `recommendedAction` 已经标准化。

3. regression coverage 更容易落地  
   可以直接断言 `kind / sections / recommendedAction`。

4. AI usefulness 更容易逐步增强  
   可以先上 deterministic structure，再逐步把模型接入更复杂排序。

### 成本与约束

1. 需要维护 contract version  
   当前固定为 `v1`。

2. 不同 feature 的 `score` 不能被误认为全局统一分值  
   它只在单次 recommendation result 内部排序有效。

3. 结构化结果与自由文本可能不完全同源  
   当前阶段这是有意设计，不是 bug。

## Current Rollout

### Phase 1：Freeze the contract

已完成：

- `src/lib/recommendation-contract.ts`
- `RecommendationHit / RecommendationSection / RecommendationAction / RecommendationResult`

### Phase 2：Use Vault mixed retrieval as the first reference implementation

已完成：

- `src/lib/vault-mixed-query.ts`
- `src/app/api/openclaw/vault/query/route.ts`
- `src/components/apps/KnowledgeVaultAppWindow.tsx`

### Phase 3：Expand into other workflow-local recommendation surfaces

已完成一部分：

- Publisher readiness recommendation 已对齐到同一 contract
- sales / creator / support / research hero workflow recommendation 已对齐到同一 section model
- Deal Desk / Support Copilot / Deep Research Hub 已开始把页面内“下一步建议”收口到同一 contract
- Content Repurposer / Inbox Declutter / Morning Brief 已开始把页面内“下一步建议”收口到同一 contract
- `src/app/api/runtime/recommendations/hero-workflow/route.ts` 已支持单链 recommendation
- `src/app/api/runtime/recommendations/hero-workflows/summary/route.ts` 已支持四条业务链 summary
- `src/components/workflows/useRuntimeHeroWorkflowSummary.ts` 已把 summary fetch 状态抽成共享 hook
- `UnifiedAssetConsole` 与 `KnowledgeVaultAppWindow` 已消费 summary contract
- creator hero recommendation 已把 section source 扩到 `asset / draft / connector runtime signals / workflow-linked tasks`
- sales / support / research hero recommendation 已补齐 `workflow-linked tasks` section

下一步：

- 继续把更多 retrieval / readiness surface 接到同一 contract，而不是新增新的 recommendation shape
- 后续新增 recommendation surface 时，优先复用既有 section source，而不是再发明新的 result shape

# AgentCore OS 状态盘点

本文是 `ADR-003 Durable State Partitioning` 的配套盘点表，用于回答三个问题：

1. 当前有哪些主要状态类型
2. 它们现在存在哪里
3. 哪些应继续 local-first，哪些应尽快 durable 化

## 分类说明

- `A`：UI Transient State
- `B`：Local-First Working Cache
- `C`：Durable Domain State
- `D`：Execution And Audit State

## 当前状态盘点

| 模块 / 状态 | 当前形态 | 当前存储 | 当前分类 | 目标方向 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Window geometry / restore geometry | 前端本地 | `localStorage` | A | 保持本地 | 纯窗口体验状态，不需要 durable |
| Sidebar 宽度 / onboarding dismiss flags | 前端本地 | `localStorage` | A | 保持本地 | 设备级偏好，不应拉进业务存储 |
| Spotlight history | 前端本地 | `localStorage` | A | 保持本地 | 轻量历史记录，丢失影响低 |
| Agent sidebar sessions / messages | 前端本地 | `localStorage` | A/B | 待拆分 | UI 会话展示可本地；若承担执行连续性，则需与 executor session 边界重审 |
| Settings: UI / personalization | local-first | `localStorage` + bootstrap | A/B | 保持 local-first | 设备级设置可继续本地优先 |
| Settings: runtime / credentials | local-first + desktop bridge | `localStorage` + desktop API | B | 独立 secure local path | 不应简单并入通用 durable domain store |
| Drafts | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第一批 durable migration，后续再从 JSON store 演进 |
| Knowledge assets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第一批 durable migration，且 `sourceKey` 作为逻辑唯一键收口 |
| Sales assets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第二批 durable migration，按 `workflowRunId` 收口 |
| Support assets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第二批 durable migration，按 `workflowRunId` 收口 |
| Creator assets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第二批 durable migration，按 `workflowRunId` 收口 |
| Research assets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已进入第二批 durable migration，按 `workflowRunId` 收口 |
| Tasks | hybrid | `localStorage` + runtime state API + server JSON store | B | 保持 B | 仍偏工作台运行记录，但已进入第三批 hybrid migration |
| Inbox | hybrid | `localStorage` + runtime state API + server JSON store | B/C | 保持 hybrid | inbox items/digests 已进入第三批 hybrid migration，兼顾工作台缓存与流程入口 |
| Briefs | hybrid | `localStorage` + runtime state API + server JSON store | B/C | 保持 hybrid | 已进入第三批 hybrid migration，承接晨报类上下文与研究闭环摘要 |
| Brain notes / digests | hybrid | `localStorage` + runtime state API + server JSON store | B | 保持 hybrid | 已进入第三批 hybrid migration，继续服务个人工作台沉淀与摘要复用 |
| Knowledge Vault file list | 前端本地 | `localStorage` | B | 待重构 | 当前更像文件清单占位，不是最终资产模型 |
| Deals | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已是 durable domain state 的参考实现 |
| Support tickets | hybrid | `localStorage` + runtime state API + server JSON store | C | 保持 C | 已是 durable domain state 的参考实现 |
| Workflow runs | hybrid | `localStorage` + runtime state API + server JSON store + tombstones | C | 保持 C | 当前最接近标准 workflow durable state |
| Publish jobs | server durable | runtime API + server JSON store | D | 保持 D | 浏览器仅做读取和发起，不应成为真源 |
| Executor sessions | server durable | runtime API + server JSON store | D | 保持 D | 已开始承载 execution history |

## 当前已经形成的模式

### 模式 1：Pure local-only

代表：

- 窗口几何
- Spotlight history
- onboarding flags
- 多数资产与工作台记录

特点：

- 实现简单
- 浏览器即真源
- 离线体验自然
- 对 workflow continuity 不够稳

### 模式 2：Hybrid local-first + runtime sync

代表：

- deals
- support tickets
- workflow runs

特点：

- 浏览器仍保留本地缓存
- server 侧已有 durable 形态
- 支持 tombstone / retry / hydrate
- 是当前阶段最值得复用的迁移桥

### 模式 3：Server-durable execution state

代表：

- publish jobs
- executor sessions

特点：

- 浏览器不是真源
- 主要面向运行连续性、审计、重试和可观察性
- 应继续强化，而不是退回 local-only

## 推荐迁移顺序

### 第一批

- knowledge assets

原因：

- drafts 与 knowledge assets 已进入 hybrid 模型
- 下一优先项应转向 sales assets / support assets

### 第二批

- creator assets
- research assets

原因：

- creator / research assets 已进入 hybrid 模型
- 第三批优先项可转向 tasks / inbox / briefs / brain notes

### 第三批

- briefs
- brain notes

原因：

- 有价值，但对 hero workflow 闭环的直接影响弱于前两批
- tasks 与 inbox 已进入 hybrid 模型，剩余两项仍可继续按批次迁移

### 单独处理

- settings
- agent sidebar sessions / messages

原因：

- settings 涉及 UI 偏好、runtime config、credentials，不适合简单套一种存储策略
- sidebar chat state 与 executor session 的边界尚未最终固定

## 当前建议

1. 新增业务状态时，先判断属于 A/B/C/D 哪一类
2. 凡是 workflow handoff 和 retained asset 相关状态，默认不要再做成 pure local-only
3. 凡是 execution / audit 相关状态，默认进入 D
4. `createServerBackedListState(...)` 作为当前阶段 durable migration 的标准桥接模式继续复用

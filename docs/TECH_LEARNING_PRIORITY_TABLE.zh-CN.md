# AgentCore OS 技术学习优先级表

本文给出当前阶段的技术学习优先级，按“主题、价值、适配角色、建议产出、是否立即投入”来排序。

## 使用方式

- 这不是“全员必学列表”
- 这是“当前 roadmap 最值得投入的底层认知清单”
- 每个主题都应绑定一个明确的仓库落点和设计产物

## 优先级表

| 优先级 | 主题 | 为什么现在值得学 | 对应仓库落点 | 适配角色 | 建议学习深度 | 最低产出 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | 搜索引擎基础 | `Knowledge Vault` 和研究工作流后续一定会遇到召回、过滤、排序和复用问题 | `Deep Research Hub`、`Knowledge Vault`、研究资产流转 | 产品负责人、全栈、核心工程师 | 中 | 检索模型与 metadata 设计 |
| P0 | 向量检索 / Hybrid Retrieval | 资产未来不能只靠关键词过滤，需要语义召回和结构化过滤结合 | `Knowledge Vault`、研究资产、销售资产、内容资产 | 核心工程师、全栈 | 中 | chunking / embedding / filtering 提案 |
| P0 | SQLite / 轻量数据库设计 | 当前大量状态仍在 `localStorage`，后续 durable persistence 是必经步骤 | 设置、草稿、任务、资产、工作流状态 | 全栈、核心工程师 | 中 | durable state 分层与 schema 草案 |
| P0 | Job Queue / Worker | 发布链路已进入队列、锁、重试、后台执行问题域 | publish queue、worker、后台任务 | 核心工程师、全栈 | 中 | job lifecycle 与 retry 设计 |
| P0 | Executor Contract / Agent Runtime | backlog 已明确要收敛 internal executor core | `src/lib/executor/*`、runtime API、OpenClaw agent 路径 | 核心工程师 | 中到深 | executor input / output / trace contract |
| P0 | Docker / 容器隔离 | connector、worker、sidecar 后续都需要更清晰的运行边界 | connector、publish worker、desktop sidecar | 核心工程师 | 中 | 运行边界与最小权限说明 |
| P1 | Workflow State Machine | 当前价值在于 workflow 闭环，而不是增加 app 数量 | sales/content/research/publish workflow | 产品负责人、全栈 | 中 | workflow 状态流转图 |
| P1 | Local-first Sync Model | 浏览器态、桌面态、服务端态后续会出现同步一致性问题 | 设置、资产、执行记录、会话 | 全栈、核心工程师 | 中 | local-first 数据分层与同步策略 |
| P1 | Tool Contract / Structured Output | AI usefulness 的提升不只在 prompt，而在 tool、schema 和动作建议 | 邮件、研究、内容、执行类 app | 核心工程师、产品负责人 | 中 | structured output 与 tool schema 规范 |
| P1 | Observability / Trace | 一旦执行链路和 worker 增多，可观察性会变成信任基础 | executor、publish、connector、sidecar | 核心工程师 | 中 | trace / event / error surface 方案 |
| P2 | LLM 基础原理 | 适合理解模型能力边界和应用设计，但不是当前交付主瓶颈 | AI app 交互、提示词、推荐动作 | 产品负责人、核心工程师 | 浅到中 | 模型能力边界与选型说明 |
| P2 | 神经网络基础 | 对核心工程师建立长期直觉有帮助，但短期不直接提速 | 长期 AI 能力建设 | 核心工程师 | 浅 | 内部分享或读书笔记 |
| Deferred | 操作系统内核 | 当前不直接解决 workflow、persistence、executor、connector 的问题 | 无直接短期仓库落点 | 少数兴趣型工程师 | 浅了解 | 无硬性要求 |
| Deferred | 编译器 | 当前与产品主线距离远，短期不会提升交付速度 | 无直接短期仓库落点 | 少数兴趣型工程师 | 浅了解 | 无硬性要求 |
| Deferred | 正则引擎实现 | 技术上有趣，但与当前仓库价值链耦合很低 | 无直接短期仓库落点 | 少数兴趣型工程师 | 浅了解 | 无硬性要求 |
| Deferred | 自研数据库 / 推理引擎 | 成本极高，且当前阶段没有必要自行承担工业级基础设施复杂度 | 无 | 不建议投入 | 不投入 | 不启动 |

## 推荐的角色关注重点

### 产品负责人

- 搜索引擎基础
- Workflow State Machine
- Tool Contract / Structured Output
- LLM 能力边界

### 前端 / 全栈工程师

- SQLite / 轻量数据库设计
- Local-first Sync Model
- Workflow State Machine
- Job Queue / Worker

### 平台 / 核心工程师

- Executor Contract / Agent Runtime
- Docker / 容器隔离
- Job Queue / Worker
- Observability / Trace
- 向量检索 / Hybrid Retrieval

## 最小决策规则

技术学习主题只有在满足下面三个条件时，才应进入团队排期：

1. 能明确服务一个现有 roadmap 瓶颈
2. 能在 3 到 6 个月内进入真实工程决策
3. 学习结束后能沉淀为仓库可消费的设计产物

## 不要这样使用这张表

- 不要把它当成“全员都要系统掌握”的课程表
- 不要把它当成“证明团队技术深度”的展示板
- 不要把 `build-your-own-x` 训练项目直接升级为正式 roadmap

## 应该这样使用这张表

- 先选 `2` 到 `4` 个主题投入
- 每个主题绑定一个 owner
- 每个主题绑定一个仓库落点
- 每个主题绑定一个最小文档产出

## 当前推荐的起步组合

如果团队现在只选四项启动，建议优先是：

1. SQLite / 轻量数据库设计
2. Job Queue / Worker
3. Executor Contract / Agent Runtime
4. 搜索引擎基础

这四项分别对应：

- durable persistence
- publish reliability
- execution convergence
- Knowledge Vault evolution

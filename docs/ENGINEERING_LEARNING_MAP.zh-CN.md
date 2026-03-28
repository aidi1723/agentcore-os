# AgentCore OS 工程学习地图

本文把底层学习方向与当前仓库主线对应起来，目标不是“学得更硬核”，而是让学习直接反哺 `Knowledge Vault`、`local-first persistence`、`internal executor core`、`connector / publish worker`。

## 设计原则

工程学习地图遵守四条原则：

1. 学习要服务当前 roadmap，而不是脱离 roadmap
2. 学习主题必须映射到真实工程瓶颈
3. 学习结束必须产出仓库可消费的设计结果
4. 学习深度以未来 3 到 6 个月的产品需要为边界

## 当前四类核心瓶颈

### 1. 资产检索与复用不足

当前状态：

- `Knowledge Vault` 更接近本地资产列表和搜索入口
- 研究资产、销售资产、发布经验还未形成真正可检索、可复用的知识层

未来会撞上的问题：

- 如何让资产跨 workflow 被准确召回
- 如何做 metadata filtering、排序、复用反馈
- 如何把“找到资产”变成“推动下一步动作”

对应学习主题：

- 搜索引擎
- 向量检索
- 混合召回
- ranking 与 snippet

### 2. local-first 状态与持久化不够稳

当前状态：

- 设置、草稿、资产、任务等大量状态仍依赖 `localStorage`
- 浏览器态、桌面态、服务端态之间的长期一致性还比较脆弱

未来会撞上的问题：

- 哪些状态应该 durable
- 如何做 schema 设计与迁移
- 如何保证跨窗口和跨运行时的数据可靠性

对应学习主题：

- SQLite
- 轻量数据库设计
- transaction / WAL
- migration strategy
- local-first sync model

### 3. 执行语义分裂

当前状态：

- backlog 已明确指出 browser / server / sidecar 存在 split execution semantics
- 当前需要收敛为统一 executor contract

未来会撞上的问题：

- session ownership 放在哪里
- context、skill、model config 如何统一
- trace、result、error surface 如何标准化

对应学习主题：

- executor contract
- agent runtime
- tool contract
- trace model
- session continuity

### 4. 连接器和后台执行边界不够清晰

当前状态：

- 发布链路已经进入 worker、锁文件、重试与后台运行问题域
- connector、sidecar、publish runner 后续都需要更稳定的运行边界

未来会撞上的问题：

- job lifecycle 如何定义
- retry / backoff / idempotency 如何设计
- 什么该跑在浏览器，什么该跑在 worker，什么应被隔离

对应学习主题：

- job queue
- worker architecture
- Docker / container isolation
- resource boundary
- observability

## 角色学习路径

### 产品负责人 / 方案负责人

目标：

- 建立对 workflow、检索、AI usefulness 和资产闭环的判断力

重点学习：

- 搜索与检索系统的产品边界
- workflow state machine
- AI 输出如何落成“下一步动作”
- asset reuse 与 feedback loop

不要求：

- 不要求实现数据库内核
- 不要求深入操作系统或编译器

应输出：

- Knowledge Vault 产品定义
- workflow handoff 设计稿
- 推荐动作与资产复用规则

### 前端 / 全栈工程师

目标：

- 把 local-first 工作台的状态、工作流和应用间流转做稳

重点学习：

- local-first state model
- SQLite / schema / migration
- workflow orchestration
- event bus 与 app-to-app handoff

不要求：

- 不要求深挖分布式数据库
- 不要求系统级容器编排

应输出：

- 状态分层清单
- durable state 迁移提案
- workflow context 传递模型

### 平台 / 核心工程师

目标：

- 建立统一执行核心和可控后台执行边界

重点学习：

- executor contract
- session ownership
- tool / skill policy
- queue / worker / retry
- container isolation

不要求：

- 不要求研究底层模型训练
- 不要求实现通用数据库

应输出：

- internal executor contract 草案
- publish worker 生命周期设计
- connector / sidecar 运行边界说明

## 建议的 90 天学习与产出计划

### 第 1 阶段：前 30 天

主题：

- 搜索 / 检索基础
- local-first 持久化基础

目标：

- 先搞清“信息怎么找”“状态怎么存”

最低输出：

- `Knowledge Vault` 检索模型草案
- 当前 `localStorage` 状态分层清单
- 哪些状态需要 durable persistence 的提案

### 第 2 阶段：31 到 60 天

主题：

- queue / worker / retry
- executor / runtime contract

目标：

- 先搞清“任务怎么跑”“执行语义如何统一”

最低输出：

- publish job lifecycle 设计
- retry / backoff / idempotency 说明
- internal executor input / output / trace 草案

### 第 3 阶段：61 到 90 天

主题：

- Docker / container boundary
- retrieval + workflow integration

目标：

- 把检索、执行、后台任务真正接进产品链路

最低输出：

- connector / worker / sidecar 的边界图
- Knowledge Vault 如何进入 sales / content / research workflow 的调用设计
- 对应最小测试门禁建议

## 学完之后必须回写什么

学习结果如果不能回写到仓库，就不算完成。建议每个主题至少回写一种产物：

- 设计文档
- schema / data contract
- executor contract
- workflow state machine
- connector boundary 文档
- 测试策略
- ADR

## 不建议当前阶段系统投入的主题

下面这些主题可以了解，但不应成为团队的集中学习目标：

- 操作系统内核
- 编译器
- 正则引擎实现
- 自研通用数据库
- 自研推理引擎

原因：

- 和未来 3 到 6 个月的仓库主线耦合度低
- 学习成本高
- 对当前交付速度帮助弱

## 团队落地建议

为了避免学习和交付脱节，建议团队按下面方式落地：

1. 每个主题限定一个明确 owner
2. 每个主题限定一个仓库落点
3. 每个主题限定一个最小设计交付物
4. 每两周复盘一次：这个学习是否真的减小了 backlog 风险

## 结论

AgentCore OS 当前最需要的不是“更硬核的底层技术炫技”，而是能支撑工作流闭环的底层判断力。学习路线也应按这个标准设计：

- 优先服务 workflow
- 优先服务 persistence
- 优先服务 executor
- 优先服务 connector / worker

只要这条主线不偏，底层学习就会成为产品推进器，而不是注意力黑洞。

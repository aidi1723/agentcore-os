# AgentCore OS 团队 Memo：如何看待 build-your-own-x

本文用于统一团队对 `build-your-own-x`、底层学习方向和当前工程投入重点的判断。

## 一句话结论

`build-your-own-x` 对 AgentCore OS 有帮助，但应该被当作“底层认知训练营”，而不是产品路线图本身。

当前阶段，团队应该优先学习那些会直接撞上现有 roadmap 瓶颈的主题，而不是把时间投入到与主线距离较远的硬核基础设施。

## 为什么现在要统一这个判断

从当前仓库可以看到，AgentCore OS 的重心已经比较明确：

- 产品定位是本地优先的 AI 工作平台和业务工作台
- 架构主体是桌面壳、多应用工作台、工作流、连接器和发布链路
- backlog 的核心是把内容、销售、研究、发布这些 workflow 做深、做稳、做成闭环
- 执行层面的重点是统一 executor 语义，而不是去造新的通用操作系统、数据库或编译器

这意味着团队的技术学习和工程建设，应该围绕下面四类问题展开：

1. 检索与知识资产复用是否足够强
2. 本地优先状态和持久化是否足够稳
3. browser / server / sidecar 的执行语义是否足够一致
4. connector / worker / publish queue 的后台执行边界是否足够可控

## 当前最值得投入的学习方向

### 1. 搜索引擎 / 向量检索

适用原因：

- 后续研究工作流要走向真正可复用的 `Knowledge Vault`
- 资产不只是“存进去”，而是要“找得到、召回准、能带入下一步”

团队应重点理解：

- 倒排索引
- 分词与召回
- 向量检索与 hybrid retrieval
- metadata filtering
- ranking 与 snippet

不要误区：

- 目标不是自研 Elasticsearch 或 Pinecone
- 目标是建立对检索系统设计边界的判断力

### 2. 数据库 / SQLite 风格持久化

适用原因：

- 当前大量业务状态仍在浏览器存储
- 一旦 workflow 状态要跨窗口、跨桌面壳、跨运行时稳定同步，耐久化建模会成为核心问题

团队应重点理解：

- schema 设计
- 索引
- 事务
- WAL
- migration
- 查询建模

不要误区：

- 目标不是造 MySQL、Postgres
- 目标是为 local-first 产品构建可靠的状态和资产层

### 3. 任务队列 / Worker / Docker 隔离

适用原因：

- 发布链路已经开始具备后台 worker、锁、重试、退避等特征
- connector、executor、sidecar 后续都会遇到运行边界和隔离问题

团队应重点理解：

- job lifecycle
- retry / backoff
- 幂等
- 锁与并发控制
- 容器边界
- 最小权限

不要误区：

- 目标不是造 Kubernetes
- 目标是把执行链路做成可恢复、可观察、可审计

## 选择性投入的学习方向

### LLM / Agent Runtime

这类主题仍然值得看，但定位应该更克制：

- 更适合产品负责人、核心工程师建立模型与执行系统直觉
- 短期重点不是造底层推理系统
- 短期重点是把 `context + tool + session + trace` 组织得更稳定

团队应重点理解：

- context shaping
- tool contract
- session continuity
- traceability
- structured output
- recommendation quality

## 当前不建议系统投入的方向

下面这些主题本身很有价值，但和当前项目主线距离太远，现阶段投入产出比偏低：

- 操作系统内核
- 编译器
- 正则引擎实现
- 自研通用数据库内核
- 自研底层推理系统

原因很简单：

- 它们不会直接提升未来 3 到 6 个月内的交付速度
- 它们不会直接解决当前 backlog 里最痛的 workflow、state、executor、connector 问题

## 团队执行原则

后续所有底层学习与技术调研，建议遵守四条原则：

1. 必须明确服务哪个现有瓶颈  
   如果说不清它将解决 `Knowledge Vault / persistence / executor / connector / publish queue` 中的哪一项，就先不投。

2. 必须输出仓库可消费的结果  
   学习结束后，至少应沉淀为以下一种：
   - schema 提案
   - executor contract
   - workflow state model
   - connector boundary 说明
   - 测试策略
   - ADR / 设计文档

3. 必须优先服务 roadmap，而不是反向绑架 roadmap  
   build-your-own-x 是训练材料，不是产品方向来源。

4. 必须控制机会成本  
   先解决未来 3 到 6 个月内一定会遇到的问题，再谈更远的底层理想。

## 建议的团队统一表述

推荐团队内部使用下面这段表述：

> 对 AgentCore OS 来说，build-your-own-x 的价值不在于教团队去造新基础设施，而在于帮助团队建立对检索、持久化、执行契约、任务隔离这些关键底层问题的判断力。真正值得投入的，是能直接强化 Knowledge Vault、workflow persistence、internal executor core、connector / publish worker 的那几类技术；离这些主线太远的硬核主题，当前阶段先不投入。

## 下一步建议

为了避免讨论停留在观点层，建议团队继续推进三件事：

1. 用工程学习地图把学习主题映射到角色和 90 天输出
2. 用优先级表把主题、价值、预计产出和适配角色固定下来
3. 在 backlog 中为 executor、Knowledge Vault、publish reliability 补齐对应设计文档和技术门禁

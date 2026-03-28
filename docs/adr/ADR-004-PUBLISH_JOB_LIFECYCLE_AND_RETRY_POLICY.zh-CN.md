# ADR-004：Publish Job Lifecycle And Retry Policy

- Status: Draft
- Date: 2026-03-27
- Owners: AgentCore OS core
- Related backlog:
  - `Make the publish flow reliable enough to support automation`
- Related docs:
  - `docs/NEXT_STEPS.md`
  - `docs/DEPLOYMENT.md`
  - `docs/CONNECTORS.md`

## Context

AgentCore OS 的发布链路已经不再只是“前端点一个按钮，然后直接发 webhook”。

当前仓库已经具备以下现实形态：

1. 浏览器侧已有 publish job 视图与 CRUD 包装  
   `src/lib/publish.ts` 通过 `/api/publish/jobs` 读取与更新任务。

2. 服务端已有 durable job store  
   `src/lib/server/publish-job-store.ts` 已把 publish jobs 写入 `.openclaw-data/publish-jobs.json`。

3. 后台队列执行器已经存在  
   `src/lib/server/publish-queue-runner.ts` 已实现：
   - 文件锁
   - 读取 queued job
   - 标记 running
   - dispatch
   - 失败后退避重试

4. dispatch 与 connector 已形成独立边界  
   `src/lib/server/publish-dispatch.ts` 负责：
   - 平台变体生成
   - dry-run / dispatch 分流
   - webhook connector 调用
   - 结果汇总

这意味着发布链路已经进入一个新的问题域：

- job state 是否足够清晰
- 谁负责 claim job、重试、停机恢复
- 浏览器和 worker 的职责边界是什么
- connector 失败、手动模式、配置缺失、网络失败该如何分类
- 当前单机锁与 JSON store 的语义边界要不要正式承认

如果这些规则不被写清楚，后续继续增强 publish reliability 时，系统会再次混入“浏览器能不能代跑队列”“失败要不要立即再试”“connector 回执到底算不算最终结果”这类语义漂移。

## Decision

AgentCore OS 决定把 publish flow 明确定义为一条由 server-owned job lifecycle 驱动的执行链，而不是浏览器驱动的即时动作。

### 1. Publish job 是 server-owned durable execution state

publish job 属于 `ADR-003` 中的 Class D：Execution And Audit State。

决策：

- job 真源在 server store
- 浏览器只负责创建、展示、人工干预和查看回执
- job 的执行推进由 queue runner / worker 负责
- 即使窗口关闭，job 语义也不应丢失

### 2. 官方 job state 固定为五态

AgentCore OS 当前阶段正式采用以下五个 job state：

- `queued`
- `running`
- `done`
- `error`
- `stopped`

语义定义：

- `queued`：任务已进入 durable queue，等待 worker claim 或等待下一次重试窗口
- `running`：任务已被某个 worker claim，正在执行 dispatch
- `done`：任务已完成，结果可查看，不能再自动重试
- `error`：任务已失败，且本轮自动重试已用尽或不允许自动重试
- `stopped`：任务被人工终止或逻辑上不应继续执行

当前阶段不新增 `retrying`、`paused`、`succeeded_with_warnings` 等额外状态。

原因：

- `retrying` 本质上仍是 `queued + nextAttemptAt`
- 当前单机实现更需要确定性，而不是增加 UI 状态花样

### 3. 生命周期转移规则固定

标准生命周期如下：

1. 浏览器或 API 创建 job -> `queued`
2. queue runner 选中可执行 job 并 claim -> `running`
3. 执行成功 -> `done`
4. 执行失败且允许自动重试 -> 回到 `queued`
5. 执行失败且不可自动重试 -> `error`
6. 人工停止 -> `stopped`

补充规则：

- 只有 worker 可以把 job 从 `queued` 推进到 `running`
- 只有 worker 可以把 `running` 推进到 `done` / `error` / `queued`
- 浏览器不应自行模拟 job 执行完成
- 浏览器允许做的“状态写入”仅限人工 stop / 清理 / 运维性修正

### 4. 重试只属于 dispatch mode

当前正式规则：

- `dry-run` job 可以进入 queue 并被执行
- 但 `dry-run` 失败后不做自动重试
- 自动重试只适用于 `mode = dispatch`

原因：

- dry-run 失败通常意味着 prompt、输入或上游配置问题，自动重试收益低
- dispatch 才是真正的后台自动化场景，才值得进入 retry / backoff 语义

### 5. Retry / backoff 策略固定为 deterministic exponential backoff

当前阶段正式采用：

| attempt | delay |
| --- | --- |
| 1 -> 2 | 1.5s |
| 2 -> 3 | 3s |
| 3 -> 4 | 6s |
| 4 -> 5 | 12s |
| 5+ | 指数增长，但上限 60s |

规则：

- 公式为 `min(60_000, 1500 * 2^(attempt - 1))`
- `attempts` 记录已发生的执行次数，而不是重试次数
- `nextAttemptAt` 是唯一官方重试时间戳
- 队列选择条件为 `status = queued && nextAttemptAt <= now`

### 6. 错误分类采用三层模型

当前阶段把 publish failure 分成三类：

#### A. Invalid job

例如：

- 缺少 `draftBody`
- 平台列表为空
- 必填字段非法

规则：

- 直接进入 `error`
- 不自动重试

#### B. Retryable execution failure

例如：

- webhook 网络异常
- connector 5xx
- 临时超时

规则：

- 若 `mode = dispatch` 且 `attempt < maxAttempts`，回到 `queued`
- 否则进入 `error`

#### C. Terminal connector/business failure

例如：

- connector 明确拒绝
- webhook 返回确定性的业务错误
- token / endpoint 持续错误

当前阶段的实现还未完全把这类错误与 B 类彻底区分，但 ADR 先固定方向：

- 能被识别为终局业务失败时，不应无限或盲目重试
- 后续 connector contract 应补上可机读的 error classification

### 7. 回执与错误元数据必须持久化在 job 上

当前 publish job 至少必须持久化以下字段：

- `status`
- `attempts`
- `maxAttempts`
- `nextAttemptAt`
- `resultText`
- `results`
- `updatedAt`

其中：

- `resultText` 负责给人读
- `results` 负责给平台维度诊断
- `attempts / nextAttemptAt` 负责恢复与运维判断

回执不应只存在 connector 响应瞬间或浏览器内存里。

### 8. 浏览器与 worker 的职责边界固定

浏览器负责：

- 创建 publish job
- 展示 queue / receipt / status
- 提供人工 stop / retry / cleanup 操作
- 查询 connector health 与 recent jobs

worker 负责：

- claim queued job
- 执行 dispatch
- 写入 attempts / nextAttemptAt / results / resultText
- 保证“同一时刻只有一个 runner 持有队列锁”

浏览器不是 job runner。  
浏览器可以触发 `/api/publish/queue/run`，但只把它看成 trigger，不把它看成执行真源。

### 9. 当前锁策略正式限定为 single-node file lock

当前阶段队列锁策略正式定义为：

- 使用 `.openclaw-data/publish-queue.lock`
- 锁内容为当前进程 PID
- 启动时可清理 stale lock
- 锁语义只覆盖单机进程互斥

这意味着：

- 当前 publish queue 明确是 single-node 设计
- 不承诺多实例并发安全
- 若未来进入多节点或外部队列，必须单独升级 ADR，而不是默默扩展现有锁语义

### 10. Idempotency 规则采用“两层承认”

#### 层 1：系统内部 idempotency

当前阶段正式承认：

- 单机 file lock + job state claim 机制，是内部避免并发重复执行的第一层保证
- 同一个 job 在正常路径下不应被多个 runner 同时执行

#### 层 2：外部 connector idempotency

当前实现尚未把 `jobId / platform / attempt` 作为正式 connector idempotency key 传出。

因此本 ADR 明确：

- 现阶段不承诺跨进程崩溃后的 exactly-once external posting
- 当前只承诺“尽量一次、可恢复、可审计”
- 后续若增强 connector contract，应优先补：
  - `jobId`
  - `platform`
  - 可选 `idempotencyKey`

## Alternatives Considered

### 方案 A：继续让浏览器既创建 job 又直接承担主要执行责任

不采纳。

原因：

- 窗口关闭后可靠性不成立
- queue / retry / audit 很难稳定
- 与 `NEXT_STEPS` 中“browser is no longer the job runner”的方向冲突

### 方案 B：失败就立即无限重试，直到成功

不采纳。

原因：

- 会掩盖配置错误和 connector 终局错误
- 容易制造重复外发风险
- 对本地单机部署不友好

### 方案 C：立即设计多节点分布式 publish queue

当前不采纳。

原因：

- 超出当前项目主线
- 现有仓库仍是本地优先工作台，不是通用调度平台
- 单机 durable queue 已足够支撑当前自动化可信度提升

## Consequences

### 正向结果

1. 发布链路的职责边界会更清晰  
   浏览器是操作与观测面，worker 是执行面。

2. retry 行为会更可预测  
   不再靠前端是否开着或用户是否再次点击决定。

3. 回执与错误排查会更稳定  
   任务状态、尝试次数、结果文本和平台结果都在 durable store 中可见。

4. 后续 connector contract 更容易标准化  
   因为 queue ownership 与 retry ownership 已经先被冻结。

### 成本与约束

1. 当前仍是 single-node 语义  
   不能假装支持多实例部署。

2. connector terminal failure 与 retryable failure 还未完全机读化  
   后续需要靠 ADR-005 继续补齐。

3. 目前 external exactly-once 仍不成立  
   若进程在 connector 已执行但 job 尚未落盘时崩溃，仍存在重复外发风险。

## Rollout

### Phase 1：Freeze lifecycle semantics

目标：

- 固定五态模型
- 固定 worker ownership
- 固定 retry/backoff 规则

动作：

- 在 ADR 中写明 lifecycle、error classes、lock 和 ownership
- 让后续 UI/worker 改动都按本 ADR 对齐

完成标准：

- 不再新增浏览器侧“偷偷推进 job 状态”的实现
- queue runner 仍是唯一官方执行推进者

### Phase 2：Improve observability and operator controls

目标：

- 让 job 状态和回执更适合排障

动作：

- 提升 Publisher UI 中的 receipt 可读性
- 明确 connector unavailable、manual fallback、retry scheduled 的展示语言
- 增加人工 retry / stop / cleanup 的显式入口

完成标准：

- 用户能清楚看出 job 当前是 queued、running、retrying-soon 还是 terminal error

### Phase 3：Strengthen connector idempotency and error typing

目标：

- 降低外部重复发布风险
- 让 retry decision 更准确

动作：

- 在 connector contract 中加入 machine-readable error type
- 为 connector 请求引入 `jobId` / `platform` / `idempotencyKey`
- 区分 retryable vs terminal connector failures

完成标准：

- publish retry 决策不再只依赖 HTTP status 和笼统异常

## Open Questions

1. `stopped` 是否只允许人工 stop，还是也允许系统在某些审批/策略场景下进入？
2. dry-run job 长期是否还需要进入 queue，还是应改为同步即时执行？
3. 是否需要为每个平台单独拆分子任务，而不是让一个 job 聚合多个平台结果？

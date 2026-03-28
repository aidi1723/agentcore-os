# ADR-005：Connector Boundary And Trust Model

- Status: Draft
- Date: 2026-03-27
- Owners: AgentCore OS core
- Related backlog:
  - `Make the publish flow reliable enough to support automation`
  - connector / sidecar 相关能力扩展
- Related docs:
  - `docs/CONNECTORS.md`
  - `docs/CONNECTOR_RECIPES.md`
  - `docs/DEPLOYMENT.md`
  - `docs/adr/ADR-004-PUBLISH_JOB_LIFECYCLE_AND_RETRY_POLICY.zh-CN.md`

## Context

随着 publish queue、background worker 和 connector health/job proxy 的落地，AgentCore OS 已经明确存在一个外部执行边界：

- 浏览器准备内容和平台意图
- server 负责 publish job lifecycle
- connector 负责把请求交给官方 API、批准的第三方服务或内部自动化链路

当前仓库已经有以下事实：

1. connector 默认走 webhook 形态  
   `src/lib/server/publish-dispatch.ts` 会把平台变体 POST 到外部 webhook。

2. connector token 与 webhook URL 由 AgentCore OS 持有并转发  
   `src/lib/publish-config.ts`、`src/lib/server/publish-config-store.ts`

3. connector health / receipt 目前以 proxy route 方式暴露  
   - `/api/publish/connector/health`
   - `/api/publish/connector/jobs`

4. 当前 connector contract 仍偏轻  
   只有最小请求体与最小 `{ ok, id }` 回执示例，但缺少：
   - 更正式的 request / response 形状
   - token 与 secret 的边界定义
   - health response 的最小能力集
   - receipt 与 error type 的约束
   - timeout / retry ownership

如果这些边界不固定，后续 publish reliability、future adapter、sidecar 扩展都会遇到同一个问题：

- AgentCore OS 和 connector 各自以为对方会处理某件事
- 结果出现重复重试、错误不可解释、回执不可追踪、trust boundary 不清晰

## Decision

AgentCore OS 决定把 connector 明确定义为外部执行边界，而不是系统内部 runtime 的延伸。

### 1. Connector 是 trust boundary，不是系统内部模块

正式定义：

- AgentCore OS 内部负责 job lifecycle、retry scheduling、UI 展示、审计记录
- connector 负责外部平台接入、第三方 API 协调、外部队列与平台级回执
- connector 不拥有 AgentCore OS 内部 job state
- AgentCore OS 也不假设 connector 是可信的内部内存或内部服务

这意味着：

- connector 响应必须被视为外部输入
- connector health 只能说明“连接器可达且自述健康”，不能替代最终平台结果
- connector receipts 需要进入 AgentCore OS 的 job result / audit 视图，但不等于自动成为唯一真相

### 2. Connector request 采用最小稳定 contract

当前阶段官方最小请求体为：

```json
{
  "platform": "xiaohongshu",
  "title": "string",
  "body": "string",
  "hashtags": ["#tag1"],
  "token": "optional",
  "dryRun": false
}
```

其中字段语义固定为：

- `platform`：目标平台标识，必须来自 AgentCore OS 支持列表
- `title`：当前平台版本标题
- `body`：当前平台版本正文
- `hashtags`：平台相关标签建议
- `token`：该平台外部接入所需的 connector-facing credential
- `dryRun`：是否只做演练、不触发真实派发

当前阶段不在 contract 中要求 connector 理解：

- workflow metadata
- AgentCore session
- full draft history
- UI state

这些都属于 AgentCore OS 内部语义，不应直接泄漏给 connector。

### 3. Token handling 采用“AgentCore 持有，connector 消费”的边界

当前正式规则：

- 平台 token 与 webhook URL 由 AgentCore OS 持久化在 server-side publish config 中
- browser 不应成为最终 credential 真源
- dispatch 时，AgentCore OS 只把当前平台执行所需的最小 token 传给 connector
- connector 自己的 webhook 鉴权、IP allowlist、签名验证由 connector 侧自行承担

这意味着：

- AgentCore OS 不负责 connector 内部 secret rotation
- connector 不应假设 AgentCore OS 会代管其内部 provider secret
- future secure storage 演进时，可以替换 publish-config store 的实现，但不改变这个 trust split

### 4. Health check contract 只回答“可达与基本就绪”

health endpoint 的目标不是证明“外部平台一定可发”，而是回答：

- connector 是否在线
- connector 是否能接受请求
- connector 是否愿意自报版本、时间和基础能力

当前最小健康回执形状固定为：

```json
{
  "ok": true,
  "name": "connector-name",
  "time": "2026-03-27T00:00:00.000Z"
}
```

后续允许扩展：

- `version`
- `capabilities`
- `queueDepth`
- `providerStatus`

但不应把 health endpoint 设计成发布结果查询接口。

### 5. Receipt contract 至少要能支持人读和追踪

当前阶段 connector receipt 最少应支持：

```json
{
  "ok": true,
  "id": "receipt-id"
}
```

推荐扩展字段：

- `platform`
- `message`
- `receivedAt`
- `queued`
- `externalId`
- `retryable`

决策：

- receipt 必须至少有稳定 `id`
- 若 connector 是异步队列，应明确返回“已接收/已排队”而不是伪装成“已真正发布”
- AgentCore OS 的 `results` 字段保存的是 connector 结果视图，不直接等价于最终平台 KPI

### 6. Timeout ownership 归 AgentCore OS，平台级长流程归 connector

当前正式规则：

- AgentCore OS 负责对 connector webhook 调用设置超时边界
- connector 若需要更长的外部发布流程，应把自己实现成：
  - 快速接受请求
  - 返回 receipt / queued acknowledgement
  - 在 connector 内部继续异步处理

换句话说：

- AgentCore OS 不等待 connector 内部长流程跑完
- connector 不应要求 AgentCore OS 长时间挂起 HTTP 请求来充当 worker

### 7. Retry ownership 固定为“AgentCore 重试 connector，connector 决定是否继续重试外部平台”

根据 `ADR-004`：

- AgentCore OS 负责 publish job 对 connector 的 retry / backoff
- AgentCore OS 不负责 connector 内部对第三方平台的所有重试细节

connector 可以有自己的内部 retry，但必须满足两条：

1. 不能要求 AgentCore OS 感知 connector 内部所有重试细节才能解释结果
2. 应尽量通过 receipt 或 status 查询表达“已接收但仍在内部处理中”

这样可以避免：

- 两边都以为是对方负责 retry
- 两边都做无限重试
- 人工无法判断失败到底发生在哪一层

### 8. Error contract 采用 machine-readable direction

当前阶段最小错误回执可以仍是：

```json
{
  "ok": false,
  "error": "message"
}
```

但方向上正式要求 future connector contract 支持：

- `errorType`
  - `auth`
  - `validation`
  - `rate_limit`
  - `temporary`
  - `provider`
  - `unknown`
- `retryable`
- `status`

原因：

- AgentCore OS 的 retry policy 需要逐步从“只看 HTTP status”升级到“看错误类型”
- UI 也需要把“凭证错误”和“临时失败”明确区分开

### 9. Connector 不能反向定义 AgentCore OS 的完成语义

connector 可以返回：

- accepted
- queued
- delivered to downstream tool
- provider rejected

但 connector 不应反向定义：

- workflow 已完成
- draft 已沉淀
- asset 已写回
- publish loop 已闭环

这些属于 AgentCore OS 内部 workflow 语义，必须由系统自己根据 job result 和人工判断推进。

## Alternatives Considered

### 方案 A：把 connector 当成 AgentCore OS 的内部插件

不采纳。

原因：

- 会模糊信任边界
- 会把外部 webhook / 第三方平台风险伪装成内部能力
- 不利于后续替换 connector 实现

### 方案 B：只保留一个极简 webhook，不定义 health / receipt / error shape

不采纳。

原因：

- 对 demo 足够，但对可靠自动化不够
- publish queue、operator UI、排障都需要更稳定的语义

### 方案 C：立即设计一个覆盖 publish、IM bridge、sidecar、future tools 的超大统一 connector spec

当前不采纳。

原因：

- 范围过大
- 当前最痛的是 publish connector 语义
- 可以先冻结 publish connector boundary，再逐步推广到其他 adapter

## Consequences

### 正向结果

1. publish 和 connector 的职责边界更清晰  
   谁负责 retry、谁负责 timeout、谁负责 receipt，会更容易解释。

2. operator UI 会更好做  
   因为 health、receipt、error 已经有稳定方向。

3. future connector / adapter 更容易接入  
   不需要每个新 connector 自己重新发明 contract。

### 成本与约束

1. 当前 contract 仍然偏 publish-specific  
   还不是所有外部 adapter 的统一规范。

2. token 目前仍会被转发到 connector  
   后续若引入更严格 secret handling，需要进一步收紧实现。

3. connector terminal failure 与 temporary failure 的机读字段还未在代码层完全收口  
   需要后续实现配合。

## Rollout

### Phase 1：Freeze publish connector semantics

目标：

- 固定 request / response / health / receipt 的最小形状
- 固定 timeout / retry ownership

动作：

- 用 ADR 冻结 trust boundary
- 后续更新 `docs/CONNECTORS.md` 与示例 connector 时按本 ADR 对齐

完成标准：

- 新 connector 不再凭感觉设计 request / receipt

### Phase 2：Improve machine-readable error and receipt fields

目标：

- 让 AgentCore OS UI 和 retry logic 能更准确地区分错误

动作：

- 给 connector response 增加 `retryable` / `errorType`
- 给 receipt 增加 `receivedAt` / `externalId` / `queued`

完成标准：

- operator 能看懂失败发生在哪一层
- retry 不再只依赖模糊错误文本

### Phase 3：Generalize to future adapters

目标：

- 把 publish connector 的边界经验推广到 future sidecar / webhook adapter

动作：

- 在不泄漏内部语义的前提下复用 trust boundary 原则
- 逐步沉淀统一 adapter vocabulary

完成标准：

- 新外部执行边界不会再次把内部 contract 与外部 contract 混成一层

## Open Questions

1. 后续是否要把 `jobId` / `idempotencyKey` 直接加入 connector 请求体？
2. Connector jobs endpoint 是否需要正式标准化，而不只是示例 connector 的本地日志查看接口？
3. token 最终是继续明文转发给 connector，还是改成由 connector 只接收平台别名并自行取密钥？

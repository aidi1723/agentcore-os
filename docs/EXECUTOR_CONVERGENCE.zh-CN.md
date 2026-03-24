# AgentCore OS 独立执行器收口方案

Last updated: 2026-03-24

## 目标

本方案只服务于 `AgentCore OS` 自身演进。

原则很简单：

- `AgentCore OS` 必须可以独立运行
- 系统主执行链必须由我们自己定义和维护
- `LobsterAI`、`openclaw`、其他程序，只能作为参考对象或可插拔适配器
- 任何外部程序都不能决定 `AgentCore OS` 的主执行语义

本次收口优先级仍然不变：

1. 稳定
2. 精准
3. 效率

## 当前问题

从现状看，系统存在的核心问题不是“功能少”，而是“执行语义分裂”。

主要表现为：

- 前端会构造完整的执行上下文，但不同后端路径消费字段的方式不同
- 部分路径默认依赖外部运行时地址，导致同一个功能在不同环境下结果不一致
- `sessionId` 已经被产品层广泛使用，但系统内部没有统一的会话存储与恢复机制
- `useSkills` 目前更接近 prompt 注入，不是可审计、可回执、可失败隔离的真实技能调度
- 健康检查更多是在检查某个外部程序是否活着，而不是检查 `AgentCore OS` 自己的端到端执行链

这会直接带来三个后果：

- 稳定性不够：不同运行形态下行为漂移
- 精准性不够：上下文、技能、系统提示词可能丢失或生效不一致
- 效率不够：排障成本高，无法快速定位是协议层、会话层、还是适配层的问题

## 收口原则

### 1. 单一执行契约

系统内部只保留一套官方执行协议，例如：

- `task`
- `session`
- `context`
- `policy`
- `skillPlan`
- `result`
- `artifacts`
- `trace`

无论最终调用什么模型、什么适配器、什么插件，前后端都必须先落到这套内部协议上。

### 2. 会话归系统所有

`session` 不是某个外部程序的能力，而是 `AgentCore OS` 自己的能力。

系统必须自己负责：

- 会话创建
- 会话隔离
- 会话摘要
- 会话恢复
- 会话归档
- 会话审计

外部适配器只能接收已经被系统整理好的上下文，不能成为唯一的会话真源。

### 3. 技能归系统调度

技能不能只停留在“告诉模型你有这些技能”。

系统需要区分三层：

- `Skill Catalog`
  角色、能力、输入输出约束、适用场景
- `Skill Planner`
  根据任务选择技能和执行顺序
- `Skill Runner`
  真正执行技能，记录输入、输出、耗时、错误和回执

模型可以参与规划，但不能代替系统调度。

### 4. 外部程序降级为适配器

以后无论是 `LobsterAI`、`openclaw` 还是其他外部程序，都只允许处于下面的位置：

- 参考实现
- 模型供应适配器
- 网关兼容适配器
- 可选工具执行后端

不允许处于下面的位置：

- 主执行契约定义者
- 主会话状态来源
- 主技能调度来源
- 主健康判断标准

## 目标架构

### A. AgentCore Executor Core

这是系统内核执行层，必须由我们自己维护。

职责：

- 接收统一任务请求
- 规范化上下文
- 绑定执行策略
- 调度技能
- 选择模型适配器
- 收集结果与工件
- 写入 trace

建议内部模块：

- `src/lib/executor/core.ts`
- `src/lib/executor/contracts.ts`
- `src/lib/executor/errors.ts`
- `src/lib/executor/policy.ts`

### B. AgentCore Session Store

这是系统自己的会话层。

职责：

- 保存每次任务输入
- 保存中间摘要
- 保存技能执行回执
- 保存最终输出
- 支持二次追问和同链路续跑

建议内部模块：

- `src/lib/executor/session-store.ts`
- `src/lib/executor/session-summary.ts`
- `src/lib/executor/session-types.ts`

优先使用本地可控存储，不依赖第三方程序内部会话格式。

### C. AgentCore Skill Runtime

这是系统自己的技能调度层。

职责：

- 维护少量高价值技能
- 对技能输入输出做强约束
- 失败时能定位是规划失败、执行失败还是外部依赖失败

第一阶段只保留与你当前方向直接相关的技能：

- 销售线索分级
- 销售跟进草拟
- 客服答复生成
- 事实核验
- 知识沉淀编辑

建议内部模块：

- `src/lib/executor/skills/catalog.ts`
- `src/lib/executor/skills/planner.ts`
- `src/lib/executor/skills/runners/*.ts`

### D. Model Adapter Layer

模型调用必须作为适配层存在，而不是执行器本体。

职责：

- OpenAI 兼容调用
- Anthropic 调用
- 未来其他供应商调用
- 参数归一化
- 超时、重试、限流、错误映射

建议内部模块：

- `src/lib/executor/adapters/openai.ts`
- `src/lib/executor/adapters/anthropic.ts`
- `src/lib/executor/adapters/index.ts`

### E. External Compatibility Layer

这一层只做兼容，不做主逻辑。

职责：

- 兼容旧 `openclaw` API 路径
- 兼容历史前端调用
- 兼容桌面 sidecar 路由
- 必要时桥接外部程序

建议内部模块：

- `src/app/api/openclaw/**` 逐步改为 compatibility facade
- `src/app/api/runtime/**` 逐步改为 runtime facade

要求：

- 所有 facade 最终都只调用 `AgentCore Executor Core`
- 不允许再各自维护一套执行语义

## 分阶段实施

### Phase 1. 先统一契约，不急着大改 UI

目标：

- 先把主执行协议统一
- 不破坏现有窗口和业务流程

动作：

- 新建内部统一请求类型 `AgentCoreTaskRequest`
- 统一字段：
  - `taskInput`
  - `session`
  - `systemPrompt`
  - `workspaceContext`
  - `skillPolicy`
  - `llmConfig`
  - `timeoutMs`
- 让现有 `/api/openclaw/agent` 和未来 runtime 路径都先转调同一个 executor core

完成标准：

- 同一请求从浏览器模式、桌面模式进入时，执行语义一致
- `systemPrompt / workspaceContext / llmConfig` 不再出现一条链路生效、另一条链路失效

### Phase 2. 建立系统自有会话层

目标：

- 彻底摆脱外部程序会话格式依赖

动作：

- 引入系统自有 session store
- 每次执行保存：
  - 原始输入
  - 系统提示词
  - 选中的技能
  - 模型适配器
  - 最终输出
  - 执行耗时
  - 错误信息
- 对销售和客服两条高频链路优先启用

完成标准：

- `Deal Desk`
- `Email Assistant`
- `Support Copilot`

这三条链路可以稳定续问、追溯和沉淀。

### Phase 3. 把技能从 prompt 提示升级为真实调度

目标：

- 让“数字员工”真正可审计、可复用、可沉淀

动作：

- 先只保留少量高价值技能
- 每个技能定义：
  - 输入 schema
  - 输出 schema
  - 失败条件
  - 回执格式
- 加一个轻量 planner，把单轮任务拆成：
  - 直接回答
  - 单技能执行
  - 双技能串联

完成标准：

- 销售链和客服链的大部分高频任务都能落到明确技能执行
- 结果可重放，可审计，可复盘

### Phase 4. 把健康检查改成系统级探针

目标：

- 健康检查不再等于“外部程序活着”

动作：

- 新增系统级 health endpoint，检查：
  - executor core 可用
  - session store 可写
  - skill catalog 可加载
  - active adapter 可调用
  - 最近一次 trace 是否正常
- 将控制台检查改为优先显示系统执行健康，而不是外部 gateway 健康

完成标准：

- 面板看到的状态，能真实反映业务可执行性

### Phase 5. 外部程序彻底适配层化

目标：

- 让系统长期保持独立演进

动作：

- 保留兼容路由
- 保留适配器
- 保留参考测试
- 但把所有核心流程都收回内部执行器

完成标准：

- 即使移除 `LobsterAI/openclaw`，系统主工作流仍可运行
- 外部程序集成只影响扩展能力，不影响主系统稳定

## 近期优先实施范围

结合你当前业务方向，建议先只收口下面两条链路：

1. 销售链
   `Deal Desk -> Email Assistant -> Personal CRM`
2. 客服链
   `Support Copilot -> Knowledge / CRM / follow-up`

原因：

- 这两条链路最高频
- 最容易验证稳定性和精准性
- 最容易沉淀为标准数字员工能力

## 验收标准

执行器收口完成后，至少满足以下标准：

- 同一任务在浏览器模式和桌面模式行为一致
- 会话上下文由系统自己管理
- 技能执行有明确回执和失败边界
- 模型供应商替换不影响主任务协议
- 健康检查能反映真实业务可执行性
- 销售与客服两条主链路可追溯、可续跑、可沉淀

## 明确不做的事

当前阶段不做下面这些事情：

- 不把外部程序内部协议继续扩散到系统内部
- 不为了兼容而维持多套主执行逻辑
- 不继续增加大量新技能角色
- 不先做复杂权限系统而推迟执行器收口

## 结论

接下来最重要的不是再增加几个 Agent 或再接几个外部程序，而是把 `AgentCore OS` 自己的执行内核收紧。

只有先完成下面四件事，系统才会真正进入稳定阶段：

1. 单一执行契约
2. 自有会话层
3. 自有技能调度层
4. 外部程序适配层化

完成这一步之后，`AgentCore OS` 才能真正成为独立运行的业务操作系统，而不是若干外部程序能力的拼接壳层。

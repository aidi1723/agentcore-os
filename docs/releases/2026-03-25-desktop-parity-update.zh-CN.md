# AgentCore OS 桌面壳等价收口更新（2026-03-25）

这份文档用于记录本轮针对**桌面壳 / sidecar 主链路**做的稳定性补齐。

它不是新的版本号说明，也不替代 `v1.1.1` 正式发布文档。
更适合用于：

- 当前主线稳定性收口记录
- GitHub / CNB 更新时的中文补充说明
- 对“浏览器壳稳定，但桌面壳是否也稳定”这一问题的明确回答

## 本轮背景

上一轮收口后，浏览器壳主线已经比较稳，但桌面壳仍有一个关键风险：

- 前端在桌面壳模式下会把 `/api/*` 请求优先切到 Python sidecar
- 但 sidecar 当时并没有完整实现这些运行时接口：
  - 执行器历史列表 / 详情
  - `deals`
  - `support`
  - `workflow-runs`

这会带来一个非常实际的问题：

- 浏览器壳能工作
- 不等于桌面壳也等价可用

按我们的原则，这种状态不能保守地叫“整体项目稳定版”。

## 本轮完成的收口

### 1. sidecar 补齐运行时状态接口

本轮已为 Python sidecar 新增并接入本地持久化：

- `GET /api/runtime/executor/sessions`
- `GET /api/runtime/executor/sessions/{sessionId}`
- `GET /api/runtime/state/deals`
- `POST /api/runtime/state/deals`
- `DELETE /api/runtime/state/deals/{dealId}`
- `GET /api/runtime/state/support`
- `POST /api/runtime/state/support`
- `DELETE /api/runtime/state/support/{ticketId}`
- `GET /api/runtime/state/workflow-runs`
- `POST /api/runtime/state/workflow-runs`
- `DELETE /api/runtime/state/workflow-runs/{runId}`

这些接口现在不再只是浏览器壳 / Next 路径独有，桌面壳也能通过 sidecar 走通。

### 2. sidecar 执行结果写入统一执行器历史

`/api/openclaw/agent` 在桌面壳模式下，现在也会：

- 记录 `sessionId`
- 记录输入消息
- 记录 system prompt
- 记录 workspace context
- 记录模型提供商 / 模型名
- 记录耗时
- 记录成功输出或失败错误

这意味着：

- 桌面壳执行不再绕过审计层
- 执行器历史面板在桌面壳下不再是“空心能力”
- 浏览器壳和桌面壳终于共用同一类沉淀结果

### 3. 桌面壳 system prompt 语义与主线收口

这次同时把 sidecar 的 AgentCore system prompt 组装逻辑对齐到了当前主线原则：

- 稳定
- 精准
- 效率
- 要求输出可审、可复核、可直接进入业务流程
- 缺少信息时必须明确指出，而不是编造

这样做的目的不是“让 prompt 更长”，而是避免浏览器壳和桌面壳因为提示词拼接差异而产生执行漂移。

## 本轮新增验证

本轮新增并通过了桌面侧烟测覆盖：

- 执行器历史列表接口
- 执行器历史详情接口
- `deals` upsert / delete / tombstone 冲突边界
- `support` upsert / delete
- `workflow-runs` 场景获胜者规则
- `workflow-runs` tombstone 行为
- `workflow-runs` delete

## 本轮验证结果

已通过：

- `npm run desktop:smoke-test-sidecar`
- `npm run test:core-workflows`
- `npm run lint`
- `npm run build`

## 当前判断

这轮之后，更准确的结论是：

- 浏览器壳与桌面壳的主执行链路，已完成关键等价补齐
- 之前“桌面壳侧 API 不完整”的高风险缺口，已经被收口
- 以当前验证范围看，项目已经更接近可以保守称为“稳定版候选已达标”

仍然需要保持的边界：

- 这不等于已经完成所有真实长期 soak 验证
- 这不等于所有平台安装包都已完成最终分发级验收
- `desktop_dify`、Docker 依赖路径、跨平台打包体验，仍应继续保守描述

## 建议口径

如果要对外或对仓库说明当前状态，建议采用类似下面的口径：

> AgentCore OS 当前已完成浏览器壳与桌面壳主链路收口，核心高频流程在本地优先模式下具备更一致的执行与沉淀能力；默认推荐仍然是命令行安装与 `desktop_light` 入口。

## 相关文件

- `lobster-sidecar/main.py`
- `lobster-sidecar/runtime_state_store.py`
- `scripts/desktop-runtime/smoke-test-sidecar.mjs`
- `README.md`
- `CHANGELOG.md`

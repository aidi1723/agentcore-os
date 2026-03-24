# AgentCore OS 稳定性更新说明（2026-03-24）

这份文档用于记录当前 `main` 分支在本轮收口中的核心变化。

这不是新的大版本发布说明，也不替代 `v1.1.1` 的正式版本文档。
它更适合用于：

- Git 提交说明的中文补充
- GitHub / CNB 同步前的变更摘要
- 当前稳定候选线的内部发布记录

## 本轮目标

这一轮不追求继续铺功能，而是围绕三条原则收口：

- 稳定
- 精准
- 效率

重点处理的是三类风险：

1. 旧工作流运行记录被陈旧客户端重新写回
2. 旧的全量快照接口误覆盖较新的服务端状态
3. 本地 JSON 持久化在并发写入或文件损坏时缺少足够保护

## 本轮完成的核心改动

### 1. `workflow-runs` 增加服务端墓碑边界

现在 `workflow-runs` 不再只是简单的列表写入，而是具备了更明确的服务端权威边界：

- 服务端持久化层增加了 tombstone 墓碑记录
- 增加 `DELETE /api/runtime/state/workflow-runs/[runId]`
- `GET /api/runtime/state/workflow-runs` 会返回 `workflowRuns + tombstones`
- `POST` 单条上送若命中被淘汰或已删除的旧 run，会返回冲突结果而不是被重新接受

同时，针对“同一 scenario 下只保留一个当前 run”的规则，这次做成了服务端硬约束，而不是只靠前端约定：

- 以 `createdAt -> updatedAt -> id` 作为优先级边界
- 同一 `scenarioId` 下，最新启动的 run 获胜
- 被 supersede 的旧 run 会留下 tombstone，后续不能被 stale client 复活

这意味着：

- 旧标签页
- 旧缓存
- 断网后恢复的陈旧请求

都更难把已经失效的运行记录重新写回系统。

### 2. 旧的全量 `PUT` 覆盖接口默认禁用

之前三条核心状态线仍保留了“整包快照覆盖”的 `PUT` 入口：

- `deals`
- `support`
- `workflow-runs`

这类接口虽然兼容性高，但对稳定性不利，因为陈旧客户端一旦整包回写，就可能覆盖较新的服务端状态。

现在这三条接口已经调整为：

- 默认返回 `409`
- 明确提示应改用单条 `POST / DELETE` 同步
- 仅在显式携带覆盖 header 时才保留兜底能力

这样做的意义是：

- 兼容入口还在
- 但默认行为已经从“危险可写”切到“安全拒绝”

### 3. `json-store` 强化为更安全的写入路径

底层本地 JSON 存储已从简单 `readFile / writeFile` 升级为更稳的方案：

- 进程内异步 mutex
- 跨进程 lockfile
- 临时文件写入
- 原子 rename 替换
- backup 文件回读恢复

这次改完后，重点提升了三个方面：

- 并发写入更不容易相互踩坏
- 写入中断时更不容易留下半文件
- 主文件损坏时，系统可从 backup 自动回退读取

对 AgentCore OS 这种本地优先、状态密集、需要长期沉淀资产的系统来说，这一步非常关键。

## 客户端同步层的配合收口

为了让上面的服务端边界真正发挥作用，客户端同步层也一并加强：

- `workflow-runs` 客户端已识别并应用 tombstone
- 单条 tombstone 应用逻辑改为走统一 `applyTombstones`
- 对于被淘汰的旧 run，本地不会再因为 hydrate 或重试逻辑把它重新放回来

这让“服务端边界”与“本地缓存行为”一致，不再出现一边删、一边复活的情况。

## 本轮验证结果

已重新通过：

- `npm run test:core-workflows`
- `npm run lint`
- `npm run build`

新增回归覆盖包括：

- `workflow run tombstone boundary`
- `legacy put guard`
- `json store hardening`

这些测试主要验证：

- superseded 的 workflow run 不会被重新写回
- 旧的全量 `PUT` 默认被拒绝
- JSON 主文件损坏后可以从 backup 恢复
- 并发 `readModifyWrite` 不会丢计数

## 当前判断

基于当前代码与验证结果，这一轮之后的 AgentCore OS 更接近：

- 稳定候选版
- 可继续推进的 RC 线

但这里仍然保持保守口径：

- 这不等于已经完成所有真实生产环境下的长期 soak 验证
- 也不等于已经覆盖所有桌面壳、断电中断、多实例并发场景

更准确的说法是：

当前核心高频链路，已经比上一轮更稳、更难被旧状态污染，也更适合继续作为默认命令行安装线推进。

## 建议提交说明

如果要把这一轮作为一次仓库更新提交，建议 commit message 采用类似下面的口径：

```text
feat: harden runtime state sync and local persistence
```

或：

```text
fix: prevent stale workflow resurrection and snapshot overwrite
```

## 相关文件

- `src/lib/server/workflow-run-store.ts`
- `src/lib/workflow-runs.ts`
- `src/app/api/runtime/state/workflow-runs/route.ts`
- `src/app/api/runtime/state/workflow-runs/[runId]/route.ts`
- `src/app/api/runtime/state/deals/route.ts`
- `src/app/api/runtime/state/support/route.ts`
- `src/lib/server/json-store.ts`
- `scripts/regression/workflows.mjs`

# OpenClaw OS v1.0.0 融合说明（2026-03-25）

这份说明用于记录 `openclaw-os` 稳定快照如何并入 `agentcore-os` 主仓视角。

它不是对 `agentcore-os main` 的替换说明，而是一份**可选择吸收的稳定基线记录**，用于后续按模块择优合并。

## 快照来源

- 来源仓工作树：`/Users/aidi/openclaw-os`
- 稳定提交：`3c029fe4dd808f434149615b64de6b2e36692b95`
- 发布标签：`openclaw-os-v1.0.0`
- 发布分支：`openclaw-os-v1.0.0`
- 提交时间：2026-03-25 15:22:39 +0800

## 这份快照代表什么

这条快照线代表一个**保守口径的 local-first 桌面壳稳定基线**。

它明确保持以下边界：

- 本地文件和本地 CLI 是主要数据源
- `Social Ops` 仍是 mock-only
- 自动化执行接口明确返回 `501 not implemented`
- 不做静默发布，不假装具备尚未完成的真实远程能力

这条边界和 `agentcore-os` 当前“稳定、精准、效率优先”的原则是兼容的，适合作为模块能力来源，而不是整仓替换目标。

## 可吸收的稳定模块

`openclaw-os-v1.0.0` 当前包含这些已经完成收口的模块：

- Taskboard 汇总页与对应 API
- Gateway 状态页与对应 API
- Nodes 状态页与对应 API
- Skills 浏览页与对应 API
- Logs 浏览页
- Social Ops mock runner
- Automation catalog 与显式 stub contract
- 本地桌面壳 UI 骨架与 iPad 风格 shell 组件
- 中英文切换与基础文案层

## 这轮稳定性加固的重点

这条稳定快照里，最值得 `agentcore-os` 参考和择优吸收的是：

- `taskboardSummary` 已从同步 I/O 切到异步读取
- `time_log.jsonl` 不再默认整文件加载
- 日志读取改为**有界反向分块扫描**，直到覆盖当天边界
- 即使尾部切入点落在残缺首行，也会跳过坏首行继续解析后续有效 JSONL
- Node 测试与 Next 构建的 TypeScript 导入方式已统一，减少“测试能过、构建失败”的漂移

## 已验证通过的命令

以下验证已在 `openclaw-os` 本地工作树通过：

```bash
npm --prefix '/Users/aidi/openclaw-os' run test
npm --prefix '/Users/aidi/openclaw-os' run lint
npm --prefix '/Users/aidi/openclaw-os' run build
```

## 融合建议

建议把这条快照视为**稳定模块来源**，按能力逐项吸收，而不是直接覆盖 `agentcore-os/main`。

更适合优先参考或合并的部分：

- taskboard 的有界日志扫描与容错实现
- local-first 状态页的数据读取边界
- mock/stub 明确暴露的产品边界表达
- 桌面壳 UI 结构和局部可复用组件

不建议直接替换的部分：

- `agentcore-os` 现有主业务链路
- 已完成桌面壳 / 浏览器壳等价收口的运行时接口
- 当前主仓的执行器、sidecar、业务状态持久化主线

## 合并时的保守原则

如果后续要继续吸收这条快照，建议遵守以下原则：

1. 不覆盖 `agentcore-os/main` 的现有运行时架构。
2. 只按模块或按文件级别择优吸收。
3. 保持 `mock-only` 与 `501` 边界的明确表达，不把未实现能力包装成可用能力。
4. 每吸收一块，都重新跑 `agentcore-os` 自己的验证门禁，而不是只参考 `openclaw-os` 的通过结果。

## 当前结论

`openclaw-os-v1.0.0` 适合作为一份**已验证过的稳定快照参考线**：

- 可以借鉴
- 可以择优融合
- 不能整仓替代 `agentcore-os`

对 `agentcore-os` 来说，更准确的定位是：
它是一份可审、可追溯、可选择吸收的外部分支基线记录。

# AgentCore OS 对外分发说明

当前建议对外分发的公开版本为 `v1.3.0`。

当前推荐安装方式：**GitHub macOS 命令行安装**。

当前对外入口建议：

- 主仓库 GitHub：<https://github.com/aidi1723/agentcore-os>
- 安装说明：`docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md`

## 适用场景

适合以下对象：

- 想先体验 AgentCore OS 的个人用户
- 需要评估本地优先 AI 工作流的团队
- 想通过 macOS 命令行快速评估项目的外部测试者
- 想评估企业数字员工 / Agent 工作流定制基础设施的潜在合作方

## 当前对外口径

- 当前推荐公开版本：`v1.3.0`
- 中文版本说明：`docs/releases/v1.3.0.zh-CN.md`
- 当前推荐安装方式：`docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md`
- 冷启动安装验收：`docs/COLD_START_VALIDATION.zh-CN.md`
- 当前工程主线：Controlled Skill / Playbook Runtime
- 当前交付状态：local delivery demo ready
- 快速本地交付门禁：`npm run delivery:ready:check`
- 当前不声明 production ready
- README 与安装说明都应围绕此版本展开

当前已经明确验收通过的主线为：

- 命令行安装
- 从源码运行
- 浏览器模式
- 当前不声明 production ready

## 分发建议

1. 对外只给 GitHub 仓库入口。
2. 安装步骤只给 `docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md`。
3. README、公开发布说明和命令行安装说明都必须指向同一个 canonical 安装页。
4. 用 `npm run release:github-macos-cli:check` 检查当前安装口径是否漂移。

## 对外说明建议

可以这样描述：

> AgentCore OS 是一个本地优先的 Controlled Skill / Playbook Runtime，用于按固定业务流程运行 AI 工作流，并通过人工审批、trace governance、失败恢复和 approved asset writeback 保证执行过程可控。当前推荐体验版本为 `v1.3.0`，当前对外安装路径只推荐 GitHub macOS 命令行安装；当前可声明 local delivery demo ready，但不声明 production ready。

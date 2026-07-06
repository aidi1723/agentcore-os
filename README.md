# AgentCore OS（智枢 OS）

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)

AgentCore OS 是一个**本地优先、面向真实工作的 AI 工作底座**。
它不是只会聊天的单点工具，而是把模型、文件、工具、审批、连接器和工作流资产，放进一个可持续积累的本地工作系统里。

> 2026-07-05 之后的工程主线已经收口为 **可控 Skill / Playbook Runtime**：固定 playbook 步骤、限制工具边界、保留人工审批、记录 trace、支持恢复，并把 approved output 写回业务资产。项目框架总纲见 [docs/PROJECT_FRAMEWORK.zh-CN.md](docs/PROJECT_FRAMEWORK.zh-CN.md)。

我们的目标很直接：

**让更多个人、团队和企业，以更低门槛、更高安全性、更强可控性，真正把 AI 用到日常业务里。**

## 当前定位

AgentCore OS 当前对外更适合这样理解：

- 一个本地优先的 AI 工作平台。
- 一个聚焦企业高频业务流程的受控执行工作台。
- 一个可以持续沉淀企业数字员工 / Agent 工作流资产的基础设施。
- 一个让 skill / playbook 按确定步骤执行的 runtime，而不是普通 skill 集合或 AI OS 外壳。

### 我们和普通 Skill / AI OS 壳的区别

传统 skill 更像“操作说明书”：它告诉模型某类任务应该怎么做，通常包含提示词、步骤建议、工具说明或输出格式。它的价值在于把经验写成可复用的方法，但它本身不一定保证执行过程可控，也不一定负责 durable state、人工审批、失败恢复、trace 复盘和资产写回。

传统 AI OS 壳更像“使用入口”：它提供桌面、窗口、应用入口、聊天界面和多工具导航。它的价值在于组织交互和展示工作区，但壳本身不等于受控执行系统。只有界面而没有 runtime，agent 仍可能临场决定步骤、跳过审批、错误写回，或者在刷新、断流、失败后丢失上下文。

AgentCore OS 当前要做的是第三种：

**Controlled Skill / Playbook Runtime。**

也就是：skill / playbook 负责描述业务流程，Runtime 负责让流程按规则执行。它会读取固定 playbook，校验步骤和 schema，限制工具边界，暂停到人工审批点，保存 durable trace，支持 resume / retry，并且只把 approved output 写回业务资产层。

因此，本项目的核心差异是：

- **不是只写 skill**：我们不只沉淀提示词或 SOP，而是让 SOP 进入可执行状态机。
- **不是只做壳**：UI、App、桌面窗口只是操作面，真正的控制权在 Runtime。
- **不是开放式 agent 发散执行**：LLM 可以生成内容和建议，但不能默认决定流程顺序、审批边界和写回目标。
- **是可审计的业务流程执行系统**：每次运行都能追踪 playbook、步骤、审批、失败、恢复和资产落点。

当前 `main` 工程主线聚焦：

- 可控 Playbook Runtime
- 销售与客服两条受控执行链：`sales-pipeline-v1`、`support-resolution-v1`
- 人工审批、durable trace、resume / retry / recovery
- approved output 写回 sales / support / knowledge / workflow / draft 资产
- governed trace artifact、fixture replay、fixture catalog、CI-style replay gates
- Runtime Console 作为查看、审批、恢复、脱敏 trace 导出和资产落点复盘的控制面
- 首页已转向 controlled playbook cockpit；Runtime Console 已有 delivery handoff 摘要和截图验证

当前项目状态：

- **已达到 local delivery demo ready**：可以通过本地 seed/check 和浏览器路径演示 Home -> Runtime Console -> controlled run -> asset landing -> governed trace copy。
- **尚未宣称 production ready**：真实 replay、长期 retention / cleanup、生产级运维边界仍需继续硬化。
- **下一阶段默认是 Trace Operations Hardening**：继续强化 trace、fixture、replay sandbox、retention 和维护路径，不继续扩大 UI 壳或新增普通 skill。

## 当前稳定版本

当前推荐对外版本：**v1.3.0**

当前稳定产品线聚焦：

- 本地优先
- BYOK / API Key 驱动
- 浏览器壳 + 桌面壳双入口
- 销售、客服、研究、创作四类工作流共享推荐结构与下一步路由
- Knowledge Vault、连接器、发布链路与应用间状态流转构成当前稳定闭环

## 当前工程主线

对外稳定线仍以 `v1.3.0` 发布资料为准；当前 `main` 分支的工程主线已经进入 **Controlled Skill / Playbook Runtime**。

维护者优先阅读：

- [项目框架总纲（中文）](docs/PROJECT_FRAMEWORK.zh-CN.md)
- [可控 Agent Runtime 开发手册](docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- [当前执行 backlog](docs/NEXT_STEPS.md)
- [Runtime Console Delivery Readiness Audit](docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md)
- [Delivery Demo Smoke Path](docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md)
- [Browser Evidence And Release Readiness Sweep](docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)
- [Post-Delivery Fixture And Playbook Expansion Review](docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md)
- [Governed Trace Operational Runbook](docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
- [Real Replay Boundary Design](docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md)
- [No-Side-Effect Replay Sandbox Prototype Design](docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md)
- [Governed Trace Fixture CI Gates](docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)

获取源码、版本信息与公开发布说明，请以仓库与 GitHub Releases 页面为准：

- 主仓库 GitHub：<https://github.com/aidi1723/agentcore-os>
- 国内镜像 CNB：<https://cnb.cool/aidiyangyu/agentcore-os>
- GitHub Releases：<https://github.com/aidi1723/agentcore-os/releases>
- 当前版本发布说明：[English](docs/releases/v1.3.0.md) / [中文](docs/releases/v1.3.0.zh-CN.md)
- 桌面壳等价收口更新（中文）：[docs/releases/2026-03-25-desktop-parity-update.zh-CN.md](docs/releases/2026-03-25-desktop-parity-update.zh-CN.md)
- 对外分发说明：[docs/EARLY_ACCESS_RELEASE.zh-CN.md](docs/EARLY_ACCESS_RELEASE.zh-CN.md)
- 上一稳定版市场发布文案：[docs/LAUNCH_COPY_v1.2.0.zh-CN.md](docs/LAUNCH_COPY_v1.2.0.zh-CN.md)
- 文档总入口：[docs/DOCUMENTATION_INDEX.zh-CN.md](docs/DOCUMENTATION_INDEX.zh-CN.md)

## 快速开始

### 本地开发体验

```bash
npm install
npm run dev
```

建议本地开发使用 Node.js 22 LTS；当前工程允许 Node.js 20 到 24。

启动后访问：

- App UI：`http://localhost:3000/`
- 可选本地 Connector UI：`http://127.0.0.1:8787/`

### 命令行安装与运行

当前推荐安装方式只有一种：**命令行安装**。

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

如果你要进一步验证桌面壳或本地 sidecar，请看：

- [命令行安装说明](docs/COMMAND_LINE_INSTALL.zh-CN.md)
- [冷启动安装验收](docs/COLD_START_VALIDATION.zh-CN.md)

### 当前已验证基线

截至 `2026-03-23`，GitHub 主仓库 `d6f6a37` 已完成一轮真实冷启动验收。
截至 `2026-03-25`，当前工作树又补跑并通过了一轮桌面壳 / sidecar 主链路等价验证。

当前已经验证通过的主线是：

- 命令行安装
- 从源码运行
- 浏览器模式
- `desktop_light` 主线
- 桌面壳 + sidecar 主链路
- 执行器历史 / 销售 / 客服 / 工作流运行在桌面壳下的服务端同步链路

当前推荐的浏览器主线最小稳定性门禁命令：

```bash
npm install
npm run test:stability
npm run dev
```

如果你要对“整个项目，包括桌面壳 sidecar 链路”做保守验收，推荐门禁改为：

```bash
npm install
npm run desktop:smoke-test-sidecar
npm run test:stability
```

## 核心能力概览

当前版本已经具备这些基础能力：

- 桌面壳与多窗口交互
- 行业工作区与场景入口
- 多个业务应用集成到同一工作台
- 销售与客服两条高频 Hero Workflow 已可跑通
- 结构化流程资产可入库、编辑、复用、追溯
- 数字员工白名单与 Reality Checker 审核层
- 多语言入口与首次启动引导
- 本地优先的运行方式与可控审批边界

## 文档入口

### 建议先看

- [项目框架总纲（中文）](docs/PROJECT_FRAMEWORK.zh-CN.md)
- [可控 Agent Runtime 开发手册](docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- [当前执行 backlog](docs/NEXT_STEPS.md)
- [Runtime Console Delivery Readiness Audit](docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md)
- [Delivery Demo Smoke Path](docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md)
- [Browser Evidence And Release Readiness Sweep](docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)
- [Post-Delivery Fixture And Playbook Expansion Review](docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md)
- [Governed Trace Operational Runbook](docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
- [文档总入口](docs/DOCUMENTATION_INDEX.zh-CN.md)
- [用户指南（中文）](docs/USER_GUIDE.zh-CN.md)
- 当前版本发布说明：[English](docs/releases/v1.3.0.md) / [中文](docs/releases/v1.3.0.zh-CN.md)
- [对外分发说明](docs/EARLY_ACCESS_RELEASE.zh-CN.md)
- [上一稳定版市场发布文案](docs/LAUNCH_COPY_v1.2.0.zh-CN.md)

### 安装与发布相关

- [命令行安装说明](docs/COMMAND_LINE_INSTALL.zh-CN.md)
- [冷启动安装验收](docs/COLD_START_VALIDATION.zh-CN.md)
- [桌面壳等价收口更新](docs/releases/2026-03-25-desktop-parity-update.zh-CN.md)
- [公开发布说明（中文）](docs/PUBLIC_RELEASE.zh-CN.md)

### 其他核心文档

- [快速开始](docs/GETTING_STARTED.md)
- [架构说明](docs/ARCHITECTURE.md)
- [连接器说明](docs/CONNECTORS.md)
- [使用场景](docs/USE_CASES.md)
- [配置说明](docs/CONFIGURATION.md)
- [部署说明](docs/DEPLOYMENT.md)
- [排障说明](docs/TROUBLESHOOTING.md)

## 常用脚本

- `npm run dev`：开发模式启动
- `npm run dev:clean`：清理后启动开发模式
- `npm run build`：生产构建
- `npm run start`：启动生产服务
- `npm run stable`：清理重建并启动稳定版本
- `npm run test:core-workflows`：运行销售 / 客服 / 知识资产 / 发布队列核心回归
- `npm run delivery:demo:seed`：写入本地受控 Runtime 交付演示数据
- `npm run delivery:demo:check`：验证本地交付演示数据和 governed trace 脱敏边界
- `npm run delivery:ready:check`：快速本地交付门禁，聚合 demo check、governed fixture、fixture summary 和 retention preview，只声明 `local_delivery_demo_ready`
- `npm run release:hygiene:check`：本地开源卫生门禁，检查必备治理文档、GPLv3+ 元数据、tracked artifact 路径和公开发布边界，不声明 production ready
- `npm run release:handoff:check`：完整本地交付前门禁，聚合 hygiene、delivery readiness、controlled runtime 测试、core workflow、lint、build 和 `git diff --check`；不发布、不打 tag、不打包安装器，只声明 `local_release_handoff_ready`
- `npm run test:stability`：运行核心回归 + lint + build 的稳定性门禁
- `npm run desktop:smoke-test-sidecar`：运行桌面 sidecar HTTP 主链路烟测
- `npm run lint`：运行 lint
- `npm run webhook:dev`：启动本地 webhook connector 示例
- `npm run publish-queue:worker`：运行后台发布队列 worker

## 开源协议

AgentCore OS 当前源代码自本次许可证迁移起采用 **GNU General Public License v3.0 or later（GPL-3.0-or-later）** 开源。

请注意：

- **当前仓库源代码** 按 GPL-3.0-or-later 许可发布
- **历史上已经按 Apache-2.0 发布的版本** 继续保留原 Apache-2.0 授权边界；本次迁移不撤销既有授权
- **Logo、商标、产品名和品牌资产** 不默认随软件许可证一起授权，除非另有明确说明
- 第三方依赖仍遵循各自原有许可证

详见：

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
- [许可证迁移说明](docs/LICENSE_CHANGE_NOTICE.md)

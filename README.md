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
- **已建立控制链路审计、proposal intake、migration plan、maintenance sequence、sequence evidence、freshness/provenance、doctor、maintenance readiness、mutation approval、mutation dry-run、lifecycle handoff、项目收尾门禁、mutation preflight、本地 mutation executor 边界、post-apply sequence gate、post-apply evidence gate、fixture refresh handoff gate、candidate fixture review gate、fixture replacement handoff gate 与 post-replacement evidence gate**：`npm run playbook:control:audit` 会本地只读审计 registered playbooks 的生命周期、步骤、schema、工具、审批、失败策略、写回目标、默认 runtime guardrails 和 governed fixture coverage；`npm run playbook:lifecycle:change:check` 会检查 playbook lifecycle 变更提案；`npm run playbook:lifecycle:migration:plan:check` 会检查迁移规划；`npm run playbook:lifecycle:sequence:check` 会检查维护顺序；`npm run playbook:lifecycle:sequence:evidence:check` / `freshness:check` / `doctor` 会检查 evidence、provenance 和可维护状态；`npm run playbook:lifecycle:maintenance:ready`、`mutation:approval:check`、`mutation:dry-run:check` 和 `handoff` 会覆盖维护准入、批准、dry-run 和 handoff；`npm run project:closeout:check` 会聚合关键本地门禁；`npm run playbook:lifecycle:mutation:executor:preview` / `apply` 会在 manifest、preflight、SHA-256 和显式确认边界下进行本地 registered playbook 文件替换；`npm run playbook:lifecycle:mutation:post-apply:sequence:check` 会在 apply 后要求 control audit、handoff、fixture gate、回归测试和 `git diff --check` 的固定顺序；`npm run playbook:lifecycle:mutation:post-apply:evidence:check` 会检查这些命令结果是否已按顺序记录为 green；`npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check` 会在 green evidence 后检查 fixture refresh 人工交接条件；`npm run playbook:lifecycle:mutation:candidate-fixture:review:check` 会在 handoff 后检查候选 fixture 的 schema/replay、敏感标记、review evidence 和 no-replacement 边界；`npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check` 会在候选 review 后检查人工 replacement handoff、rollback evidence 和 post-replacement validation plan；`npm run playbook:lifecycle:mutation:post-replacement:evidence:check` 会在人工替换后检查 fixture/runtime/core/diff evidence 和 no-publish/no-production 边界。
- **当前 controlled-runtime 里程碑可以本地收尾，并已进入 Productionization Preparation 的受控写入边界阶段**：核心 runtime 已经成型，playbook lifecycle 已有 proposal -> plan -> sequence -> evidence -> freshness/doctor -> readiness -> approval -> dry-run -> closeout -> preflight -> manifest preview/apply -> post-apply sequence -> post-apply evidence -> fixture refresh handoff -> candidate fixture review -> fixture replacement handoff -> post-replacement evidence 的本地链路；但完整 authoring UI/versioning flow、release handoff review integration、统一 policy/guardrail、真实 replay、外部 connector 写回和生产级运维仍需继续硬化。
- **尚未宣称 production ready**：真实 replay、长期 retention / cleanup、生产级运维边界仍需继续硬化。
- **下一阶段默认是 Productionization Preparation**：在当前里程碑收尾后，继续推进 release handoff review integration、统一 policy/guardrail、fixture/replay depth、authoring UI 和生产运维准备，不继续扩大 UI 壳或新增普通 skill。

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
- `npm run playbook:control:audit`：本地只读 playbook 控制链路审计，检查 registered playbooks 的生命周期、控制合同、默认 runtime guardrails 和 fixture coverage
- `npm run playbook:lifecycle:review`：本地只读 playbook 生命周期复审诊断，检查 active playbooks 是否达到 `lastReviewedAt + reviewCadenceDays`，只输出维护信号
- `npm run playbook:lifecycle:handoff`：本地只读 version/deprecation handoff checklist，聚合 control audit 与 lifecycle review，汇总 active/experimental/deprecated 数量和 deprecated replacement chains；不执行迁移、不改 fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:change:check -- --proposal <path>`：本地只读 playbook lifecycle change proposal gate，检查提案 JSON 的 spec/plan、必需命令、fixture expectation 和 deprecation metadata；不修改 playbook、不刷新 fixture、不执行迁移
- `npm run playbook:lifecycle:migration:plan:check -- --plan <path>`：本地只读 playbook lifecycle migration plan gate，检查 plan JSON 的 proposal linkage、planned changes、rollback、fixture review、必需命令和 no-mutation policy；不批准迁移、不执行迁移、不修改 playbook 或 fixture
- `npm run playbook:lifecycle:sequence:check -- --sequence <path>`：本地只读 playbook lifecycle maintenance sequence gate，检查 proposal check、migration plan check、lifecycle handoff、governed fixture gate 和 controlled runtime test 是否按顺序声明并保持 no-mutation / no-publish policy；不执行命令、不修改 playbook 或 fixture、不发布
- `npm run playbook:lifecycle:sequence:evidence:check -- --evidence <path>`：本地只读 playbook lifecycle sequence evidence gate，检查记录的命令 evidence 是否按 sequence 顺序覆盖、全部 green，并保持 `sequenceOnly` / `handoffOnly` / fixture / controlled-runtime / no-mutation / no-publish 边界；不执行命令、不生成 evidence、不修改 playbook 或 fixture、不发布
- `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence <path>`：本地只读 playbook lifecycle sequence evidence freshness/provenance gate，检查 evidence 的 source commit、sequence digest 和 max-age freshness；不执行命令、不生成 evidence、不修改 playbook 或 fixture、不发布
- `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence <path>`：本地只读 playbook lifecycle sequence evidence doctor，诊断 missing / invalid / stale / commit mismatch / digest mismatch / future recordedAt 等状态并给出下一步命令；不执行建议命令、不生成 evidence、不修改 playbook 或 fixture、不发布
- `npm run playbook:lifecycle:maintenance:ready -- --evidence <path>`：本地只读 playbook lifecycle maintenance readiness gate，聚合 lifecycle handoff 与 sequence evidence doctor；不执行建议命令、不生成 evidence、不修改 playbook 或 fixture、不发布
- `npm run playbook:lifecycle:mutation:approval:check -- --approval <path>`：本地只读 playbook lifecycle mutation approval receipt gate，检查 readiness green 后的结构化批准回执和 no-execution / no-write / no-publish 边界；不执行迁移、不修改 playbook 或 fixture、不写 store、不发布
- `npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>`：本地只读 playbook lifecycle mutation dry-run gate，检查 approval 后的拟变更 playbook 文件、fixture impact 和 dry-run-only 边界；不执行迁移、不修改 playbook 或 fixture、不写 store、不发布
- `npm run project:closeout:check -- --evidence <path> --dry-run <path>`：本地只读 controlled-runtime 收尾门禁，聚合 playbook control audit、lifecycle maintenance readiness、mutation dry-run 和 delivery readiness，并把真实迁移器、authoring UI、统一 policy、真实 replay、外部 connector 和生产运维明确标记为下一阶段；不发布、不写 store、不宣称 production ready
- `npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>`：本地只读 Productionization Preparation 门禁，在真实 mutation executor 前聚合 closeout、dry-run、approval、target scope 和 dry-run-only 边界；不执行迁移、不修改 playbook 或 fixture、不写 store、不发布
- `npm run playbook:lifecycle:mutation:executor:preview -- --manifest <path> --evidence <path> --dry-run <path>`：本地只读 mutation executor preview，重新跑 preflight，并校验 manifest、dry-run 声明的目标路径、当前 SHA-256、next content SHA-256 和 executor-only 边界；不写文件
- `npm run playbook:lifecycle:mutation:executor:apply -- --manifest <path> --evidence <path> --dry-run <path> --confirm-apply`：本地 mutation executor apply，只在显式确认后替换 `src/lib/executor/playbooks/` 下的 manifest 目标文件；不刷新 fixture、不写 store、不调用外部 connector、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:post-apply:sequence:check -- --sequence <path>`：本地只读 post-apply audit sequence gate，要求 apply 后按顺序声明 control audit、lifecycle handoff、fixture gate、controlled-runtime、core-workflows 和 `git diff --check`；不执行命令、不刷新 fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence <path>`：本地只读 post-apply audit evidence gate，检查已记录命令结果是否严格匹配 post-apply sequence 且全部 green；仍不刷新 fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff <path>`：本地只读 fixture refresh handoff gate，在 post-apply evidence green 后检查目标 playbook、fixture ids、人工 review checklist 和 handoff-only 边界；不生成候选 fixture、不替换 committed fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review <path>`：本地只读 candidate fixture review gate，在 fixture refresh handoff green 后检查候选 fixture validation/replay、目标 catalog fixture、敏感标记、人工 review evidence 和 no-replacement 边界；不生成候选 fixture、不替换 committed fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff <path>`：本地只读 fixture replacement handoff gate，在 candidate fixture review green 后检查目标/path 对齐、rollback evidence、post-replacement validation plan 和 handoff-only 边界；不替换 committed fixture、不刷新 fixture、不发布、不宣称 production ready
- `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence <path>`：本地只读 post-replacement fixture evidence gate，在人工 committed fixture replacement 后检查 handoff、fixture catalog、fixture summary、controlled-runtime、core-workflows 和 diff evidence；不替换 fixture、不运行命令、不发布、不宣称 production ready
- `npm run release:hygiene:check`：本地开源卫生门禁，检查必备治理文档、GPLv3+ 元数据、tracked artifact 路径和公开发布边界，不声明 production ready
- `npm run release:handoff:check`：完整本地交付前门禁，聚合 hygiene、delivery readiness、controlled runtime 测试、core workflow、lint、build 和 `git diff --check`；不发布、不打 tag、不打包安装器，只声明 `local_release_handoff_ready`
- `npm run release:handoff:snapshot`：运行完整 handoff gate，并把门禁结果与 git 上下文写入本地 `output/release-handoff/` JSON 证据；新证据同时保留短 SHA `snapshot.git.commit` 和完整 SHA `snapshot.git.commitFull`；不发布、不上传、不打 tag，生成文件默认不提交
- `npm run release:handoff:snapshot:check -- <snapshot.json>`：只读校验本地 handoff evidence 的 schema 和发布边界；不发布、不上传、不修改 evidence
- `npm run release:handoff:snapshot:index -- --check --limit 5`：只读列出并可校验本地 handoff evidence 快照，便于交付复核最新证据；不创建、不修改、不发布 evidence
- `npm run release:handoff:evidence:check`：只读确认最新本地 handoff evidence 已校验且匹配当前 `HEAD`；新证据优先用完整 SHA `snapshot.git.commitFull` 对比，旧证据回退 `snapshot.git.commit` 短 SHA；过期时重新生成 snapshot，不自动修改 evidence
- `npm run release:handoff:evidence:doctor`：只读诊断最新 handoff evidence 是否缺失、无效、失败、过期或最新，并输出下一条建议命令；诊断使用同一套完整 SHA 优先、短 SHA 兼容规则；只建议、不自动生成或发布 evidence
- `npm run release:handoff:evidence:status`：只读汇总 doctor 和最近 snapshot index 校验结果，报告本地 handoff evidence 是否可用于交付复核，并透传完整 SHA 诊断字段；不运行 handoff gate、不生成 snapshot、不发布
- `npm run release:handoff:evidence:audit`：只读审计最近 handoff evidence 快照窗口，汇总成功、失败、无效、invalid JSON 和完整 SHA 覆盖情况，并建议下一条本地命令；不运行 handoff gate、不生成或修改 snapshot、不发布
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

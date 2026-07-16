# AgentCore OS 文档总入口

这是当前 `v1.3.0` 稳定版对外发布对应的中文入口页。

> 2026-07-05 起，内部工程主线已经从“继续扩展 AI OS 壳”调整为“可控 Skill / Playbook Runtime”。截至 2026-07-16，当前 controlled-runtime 里程碑已有本地 closeout gate、manifest-based mutation executor preview/apply 边界、完整 release-control gate 链路、release execution approval boundary、production release completion evidence boundary，以及 Engineering Hardening Stage 2（严格 TypeScript 清零、干净 worktree 测试确定性、发布 webhook DNS 全量校验 + 固定地址连接、special-use IPv4 拒绝）。`release:completion:evidence:check` 可验证 schema-only 示例包，也可在人工/operator 真实执行后验证 `operator_recorded_actual_execution` evidence packet；仓库 tracked example 不等于 production ready。本地工程门禁通过不等于安装包签名、真实外部 Connector 或生产发布完成。下一步继续 production closeout / operations evidence hardening、依赖安全维护（含 Next.js 安全升级评估）、authoring UI、统一 policy、real replay、connector 写回和生产运维。后续开发请先阅读项目框架总纲、设计目标完成状态、可控 Runtime 开发手册、Roadmap、Next Steps、2026-07-16 审查收尾、交付演示路径、浏览器证据、UI 收尾、交付后扩展复核、governed trace 运维文档和 real replay / sandbox 边界文档。

## 建议阅读顺序

1. [README](../README.md)
2. [项目框架总纲](PROJECT_FRAMEWORK.zh-CN.md)
3. [可控 Agent Runtime 开发手册](CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
4. [设计目标完成状态](DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md)
5. [架构说明](ARCHITECTURE.md)
6. [路线图](ROADMAP.md)
7. [当前执行 backlog](NEXT_STEPS.md)
8. [Runtime Console Delivery Readiness Audit](RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md)
9. [Delivery Demo Smoke Path](DELIVERY_DEMO_SMOKE_PATH.zh-CN.md)
10. [Browser Evidence And Release Readiness Sweep](BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)
11. [Runtime UI Delivery Polish Closeout](RUNTIME_UI_DELIVERY_POLISH_CLOSEOUT.zh-CN.md)
12. [Post-Delivery Fixture And Playbook Expansion Review](POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md)
13. [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
14. [Real Replay Boundary Design](REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md)
15. [No-Side-Effect Replay Sandbox Prototype Design](NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md)
16. [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)
17. [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
18. [Production Release Completion Evidence Boundary](PRODUCTION_RELEASE_COMPLETION_EVIDENCE_BOUNDARY.zh-CN.md)
19. [全项目审查与优化收尾（2026-07-16）](PROJECT_AUDIT_OPTIMIZATION_CLOSEOUT_2026-07-16.zh-CN.md)
20. [许可证迁移说明](LICENSE_CHANGE_NOTICE.md)
21. 当前版本发布说明：[English](releases/v1.3.0.md) / [中文](releases/v1.3.0.zh-CN.md)
22. [公开发布说明（中文）](PUBLIC_RELEASE.zh-CN.md)
23. [GitHub macOS 命令行安装](GITHUB_MACOS_CLI_INSTALL.zh-CN.md)
24. [快速开始](GETTING_STARTED.md)
25. [用户指南（中文）](USER_GUIDE.zh-CN.md)

## 对外分发

- [GitHub macOS 命令行安装](GITHUB_MACOS_CLI_INSTALL.zh-CN.md)
- [Early Access 对外分发说明](EARLY_ACCESS_RELEASE.zh-CN.md)
- [命令行安装说明](COMMAND_LINE_INSTALL.zh-CN.md)
- [冷启动安装验收](COLD_START_VALIDATION.zh-CN.md)
- [桌面壳等价收口更新](releases/2026-03-25-desktop-parity-update.zh-CN.md)
- [OpenClaw OS v1.0.0 融合说明](releases/2026-03-25-openclaw-os-v1.0.0-integration-note.zh-CN.md)
- [GitHub / CNB 发布正文（中文）](releases/v1.2.0-github-release.zh-CN.md)
- [许可证迁移说明](LICENSE_CHANGE_NOTICE.md)

## 其他核心文档

- [项目框架总纲](PROJECT_FRAMEWORK.zh-CN.md)
- [设计目标完成状态](DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md)
- [可控 Agent Runtime 开发手册](CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- [架构说明](ARCHITECTURE.md)
- [路线图](ROADMAP.md)
- [当前执行 backlog](NEXT_STEPS.md)
- [连接器说明](CONNECTORS.md)
- [使用场景](USE_CASES.md)
- [配置说明](CONFIGURATION.md)
- [部署说明](DEPLOYMENT.md)
- [排障说明](TROUBLESHOOTING.md)

## 内部工程与学习

- [企业级执行层升级方案](AGENT_EXECUTION_ENTERPRISE_UPGRADE.zh-CN.md)
- [Runtime Console Delivery Readiness Audit](RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md)
- [Delivery Demo Smoke Path](DELIVERY_DEMO_SMOKE_PATH.zh-CN.md)
- [Browser Evidence And Release Readiness Sweep](BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)
- [Runtime UI Delivery Polish Closeout](RUNTIME_UI_DELIVERY_POLISH_CLOSEOUT.zh-CN.md)
- [Post-Delivery Fixture And Playbook Expansion Review](POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md)
- [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
- [Real Replay Boundary Design](REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md)
- [No-Side-Effect Replay Sandbox Prototype Design](NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md)
- [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)
- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
- [Governed Trace Fixture Catalog Coverage](GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md)
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
- [Production Release Completion Evidence Boundary](PRODUCTION_RELEASE_COMPLETION_EVIDENCE_BOUNDARY.zh-CN.md)
- [全项目审查与优化收尾（2026-07-16）](PROJECT_AUDIT_OPTIMIZATION_CLOSEOUT_2026-07-16.zh-CN.md)
- [Engineering Hardening Stage 2 设计](superpowers/specs/2026-07-16-engineering-hardening-stage-2-design.md)
- [Engineering Hardening Stage 2 实现计划](superpowers/plans/2026-07-16-engineering-hardening-stage-2.md)
- [许可证迁移说明](LICENSE_CHANGE_NOTICE.md)
- [团队 Memo：如何看待 build-your-own-x](TEAM_MEMO_BUILD_YOUR_OWN_X.zh-CN.md)
- [工程学习地图](ENGINEERING_LEARNING_MAP.zh-CN.md)
- [技术学习优先级表](TECH_LEARNING_PRIORITY_TABLE.zh-CN.md)
- [状态盘点](STATE_INVENTORY.zh-CN.md)
- [Next Steps 对应的技术 ADR 清单](TECH_ADR_BACKLOG.zh-CN.md)
- [ADR-001：Internal Executor Contract](adr/ADR-001-INTERNAL_EXECUTOR_CONTRACT.zh-CN.md)
- [ADR-003：Durable State Partitioning](adr/ADR-003-DURABLE_STATE_PARTITIONING.zh-CN.md)
- [ADR-004：Publish Job Lifecycle And Retry Policy](adr/ADR-004-PUBLISH_JOB_LIFECYCLE_AND_RETRY_POLICY.zh-CN.md)
- [ADR-005：Connector Boundary And Trust Model](adr/ADR-005-CONNECTOR_BOUNDARY_AND_TRUST_MODEL.zh-CN.md)

## 历史说明

- [macOS 未签名安装说明](MACOS_UNSIGNED_INSTALL.zh-CN.md)
- [macOS 签名与公证说明](MACOS_SIGNING_AND_NOTARIZATION.zh-CN.md)

# Changelog

All notable changes to AgentCore OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0-beta.1] - 2026-09-12

### 🎉 Beta Release

AgentCore OS v1.3.0 首次公开 Beta 版本发布！

这是一个**本地优先、面向真实工作的 AI 工作底座**，核心特点是 **Controlled Playbook Runtime**——让 AI 工作流按固定步骤、受控边界、人工审批、可追溯执行。

### 🎯 核心特性

#### Controlled Playbook Runtime
- ✅ **固定 playbook 步骤** - LLM 不能随意发散，必须按预定步骤执行
- ✅ **限制工具边界** - 只能调用允许的工具，不能乱调用
- ✅ **保留人工审批** - 关键节点必须人工确认才能继续
- ✅ **记录 durable trace** - 每次执行都完整记录，可追溯可审计
- ✅ **支持 resume/retry/recovery** - 失败后可以从断点恢复
- ✅ **approved output 写回** - 只有审批通过的内容才写入业务系统

#### 销售和客服执行链
- ✅ `sales-pipeline-v1` - 销售流程受控执行
- ✅ `support-resolution-v1` - 客服流程受控执行
- ✅ 人工审批点
- ✅ Durable state 管理
- ✅ 资产写回（sales/support/knowledge/workflow/draft）

#### Runtime Console
- ✅ Controlled run 查看和管理
- ✅ 审批操作界面
- ✅ 恢复和重试功能
- ✅ Governed trace 导出
- ✅ Asset landing 复盘
- ✅ Delivery handoff 摘要

#### 治理和审计
- ✅ Governed trace artifact
- ✅ Fixture replay 机制
- ✅ Fixture catalog
- ✅ CI-style replay gates
- ✅ 完整的生命周期管理

### 📚 文档体系

- ✅ **309 个文档文件**（中英双语）
- ✅ 项目框架总纲
- ✅ 开发手册
- ✅ API 文档
- ✅ 架构设计
- ✅ 安装指南
- ✅ 最佳实践

### 🔧 技术栈

- React 19.0.0
- Next.js 15.5.20
- TypeScript (strict mode)
- Node.js >=20 <25
- Zustand 5.0.3
- Lucide React 0.468.0

### 🎨 UI/UX 改进

#### 设计系统
- ✅ 100+ design tokens
- ✅ 统一的颜色、间距、字体系统
- ✅ 响应式布局
- ✅ 无障碍支持

#### Runtime 专用组件（Phase 1）
- ✅ **PipelineFlow** - Pipeline 可视化组件
  - 横向流程图展示
  - 清晰的状态标识
  - 审批点特殊高亮
  - 当前步骤强调
- ✅ **ApprovalCard** - 审批卡片强化
  - 醒目的警告色
  - 脉动动画
  - 内容预览
  - 大号批准/拒绝按钮

### ⚠️ Beta 版本说明

**当前状态**: Local delivery demo ready

**适合场景**:
- ✅ 本地开发和测试
- ✅ 概念验证（POC）
- ✅ 小规模试用
- ⚠️ 生产环境请谨慎评估

**已知限制**:
- 真实 replay 功能正在完善
- 生产运维工具待增强
- 部分高级特性待优化
- Runtime UI 可控性视觉化待集成（Phase 1 组件已完成）

**不适合场景**:
- ❌ 大规模生产部署（请等待正式版）
- ❌ 关键业务流程（建议充分测试后使用）

### 🐛 问题修复

- 修复 clsx 依赖缺失导致的构建失败

### ✅ 测试覆盖

- 138 个测试文件
- 核心工作流回归测试通过
- Lint 检查 0 错误
- TypeScript 类型检查通过

### 📦 安装

详见安装文档：[docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md](docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md)

### 🔗 资源链接

- GitHub: https://github.com/aidi1723/agentcore-os
- 文档: [docs/DOCUMENTATION_INDEX.zh-CN.md](docs/DOCUMENTATION_INDEX.zh-CN.md)
- 问题反馈: https://github.com/aidi1723/agentcore-os/issues
- 讨论区: https://github.com/aidi1723/agentcore-os/discussions

### 🙏 致谢

感谢所有早期测试者的反馈和支持！

---

## [Unreleased]

### Planned for v1.3.0 (正式版)
- Runtime Console UI 集成（PipelineFlow/ApprovalCard）
- TraceTimeline 组件（时间线视图）
- RecoveryPanel 组件（失败恢复面板）
- AssetLandingList 组件（资产可视化）
- 真实 replay 完善
- 生产运维工具增强
- 性能优化
- Production hardening

---

[1.3.0-beta.1]: https://github.com/aidi1723/agentcore-os/releases/tag/v1.3.0-beta.1

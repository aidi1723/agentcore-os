# 📚 AgentCore OS 文档导航

> **快速导航**: 根据你的角色和需求，快速找到对应文档。

---

## 🚀 新手入门（5-30 分钟）

**我是第一次接触，想快速体验**

1. ⚡ [5 分钟快速上手](../QUICKSTART.md) - 最快的体验路径
2. 📖 [README](../README.md) - 项目概览和功能介绍
3. 🎯 [GitHub macOS 命令行安装](GITHUB_MACOS_CLI_INSTALL.zh-CN.md) - 官方推荐安装方式

**我想理解这个项目是做什么的**

- 🎨 [项目框架总纲](PROJECT_FRAMEWORK.zh-CN.md) - 项目定位、目标、非目标
- 🏗️ [架构说明](ARCHITECTURE.md) - 系统分层和核心模块
- 🗺️ [路线图](ROADMAP.md) - 当前进展和未来规划

---

## 👨‍💻 开发者文档（30-120 分钟）

**我想参与开发或贡献代码**

1. 🛠️ [贡献指南](../CONTRIBUTING.md) - 开发环境、代码规范、PR 流程
2. 📋 [当前任务 Backlog](NEXT_STEPS.md) - 正在进行的工作和待办事项
3. 📘 [可控 Agent Runtime 开发手册](CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md) - 核心技术详解（106KB 长文）

**我想理解核心技术实现**

- 🔧 [Playbook 控制审计](PROJECT_FRAMEWORK.zh-CN.md#42-plan-validator) - 如何校验和执行 playbook
- 🗄️ [Runtime 状态管理](ARCHITECTURE.md#runtime-state) - 持久化、恢复、trace
- 🔍 [Governed Trace 运维手册](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md) - 追踪、fixture、replay

---

## 👥 用户文档（依场景）

**我想实际使用这个系统**

- 📗 [用户指南](USER_GUIDE.zh-CN.md) - 启动、配置、自测、排障
- 🔌 [连接器说明](CONNECTORS.md) - 如何接入飞书/钉钉/Webhook
- ⚙️ [配置说明](CONFIGURATION.md) - API Key、环境变量、运行时配置
- 🚢 [部署说明](DEPLOYMENT.md) - 生产环境部署指南
- 🐛 [排障说明](TROUBLESHOOTING.md) - 常见问题和解决方案

**我想了解具体使用场景**

- 💼 [使用场景](USE_CASES.md) - 销售、客服、研究、创作等场景
- 🎯 [快速开始](GETTING_STARTED.md) - 从零开始的完整流程

---

## 🔬 高级主题（深度阅读）

**Runtime 核心机制**

- 🎭 [Real Replay 边界设计](REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md) - 真实回放的安全边界
- 🧪 [无副作用 Replay 沙盒原型设计](NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md)
- 🔐 [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)

**发布和质量保证**

- ✅ [Runtime Console 交付就绪审计](RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md)
- 🎬 [交付演示烟测路径](DELIVERY_DEMO_SMOKE_PATH.zh-CN.md)
- 🌐 [浏览器证据与发布就绪扫描](BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md)
- 📦 [生产发布完成证据边界](PRODUCTION_RELEASE_COMPLETION_EVIDENCE_BOUNDARY.zh-CN.md)

**项目治理**

- 🏛️ [开源检查清单](OPEN_SOURCE_CHECKLIST.md)
- 🔄 [许可证变更通知](LICENSE_CHANGE_NOTICE.md)
- 📰 [早期访问发布说明](EARLY_ACCESS_RELEASE.zh-CN.md)
- 🎉 [v1.3.0 发布说明](releases/v1.3.0.zh-CN.md)

---

## 📊 项目审核报告（2026-09-12 新增）

**我想了解项目整体质量**

- 📋 [审核报告执行摘要](../AUDIT_SUMMARY.md) - 一页纸快速了解项目评级
- 📊 [完整项目审核报告](../PROJECT_AUDIT_REPORT.md) - 15,000 字深度分析（代码质量、架构、文档、风险）

---

## 🗂️ 专题文档

### 设计与 UI

- 🎨 [AgentCore OS UI 设计主指南](AGENTCORE_OS_UI_DESIGN_MASTER_GUIDELINE.zh-CN.md)
- 📎 [Paperclip UI 参考](AGENTCORE_OS_UI_REFERENCES_FROM_PAPERCLIP.zh-CN.md)
- 🎯 [设计目标完成状态](DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md)

### 历史与演进

- 🔄 [冷启动安装验收](COLD_START_VALIDATION.zh-CN.md)
- 📦 [命令行安装说明](COMMAND_LINE_INSTALL.zh-CN.md)
- 🎊 [v1.2.0 市场发布文案](LAUNCH_COPY_v1.2.0.zh-CN.md)
- 🏗️ [Agent 执行企业升级](AGENT_EXECUTION_ENTERPRISE_UPGRADE.zh-CN.md)
- 🤝 [Agency Agents 精选集成计划](AGENCY_AGENTS_CURATED_INTEGRATION_PLAN.zh-CN.md)

### ADR (架构决策记录)

- 📁 [架构决策记录目录](adr/)
  - 查看项目历史上的重大技术决策和原因

### Superpowers 系列（历史规划）

- 📂 [Superpowers 设计规格](superpowers/specs/)
- 📂 [Superpowers 实施计划](superpowers/plans/)

---

## 🎯 按角色快速导航

### 🆕 我是新用户

```
1. QUICKSTART.md (5 分钟)
2. README.md (10 分钟)
3. USER_GUIDE.zh-CN.md (30 分钟)
```

### 💻 我是开发者

```
1. CONTRIBUTING.md (15 分钟)
2. ARCHITECTURE.md (30 分钟)
3. CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md (2 小时)
4. NEXT_STEPS.md (10 分钟)
```

### 🏢 我是决策者/管理者

```
1. AUDIT_SUMMARY.md (5 分钟)
2. PROJECT_FRAMEWORK.zh-CN.md (30 分钟)
3. ROADMAP.md (15 分钟)
4. PROJECT_AUDIT_REPORT.md (可选，60 分钟深度阅读)
```

### 🔬 我是研究者/架构师

```
1. ARCHITECTURE.md (30 分钟)
2. REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md (45 分钟)
3. GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md (45 分钟)
4. NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md (45 分钟)
```

---

## 📈 文档统计

- 📄 **总文档数**: 309 个 Markdown 文件
- 🌍 **语言**: 中文 + 英文双语
- 📦 **核心文档**: ~30 个（已在上方列出）
- 🔄 **更新频率**: 活跃维护中

---

## ❓ 找不到想要的文档？

1. 🔍 **使用文件搜索**: `grep -r "关键词" docs/`
2. 💬 **提交 Issue**: [GitHub Issues](https://github.com/aidi1723/agentcore-os/issues)
3. 📖 **查看完整列表**: `ls -R docs/` 列出所有文档

---

**上次更新**: 2026-09-12  
**文档版本**: v1.3.0

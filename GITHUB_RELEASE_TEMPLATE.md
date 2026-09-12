# GitHub Release 描述文本

复制以下内容到 GitHub Release 描述框：

---

# 🎉 AgentCore OS v1.3.0-beta.1 (Public Beta)

**AgentCore OS v1.3.0 首次公开 Beta 版本发布！**

这是一个**本地优先、面向真实工作的 AI 工作底座**，核心特点是 **Controlled Playbook Runtime**——让 AI 工作流按固定步骤、受控边界、人工审批、可追溯执行。

---

## 🎯 核心特性

### Controlled Playbook Runtime
- ✅ **固定 playbook 步骤** - LLM 不能随意发散，必须按预定步骤执行
- ✅ **限制工具边界** - 只能调用允许的工具
- ✅ **保留人工审批** - 关键节点必须人工确认
- ✅ **记录 durable trace** - 每次执行都完整记录，可追溯可审计
- ✅ **支持 resume/retry/recovery** - 失败后可以从断点恢复
- ✅ **approved output 写回** - 只有审批通过的内容才写入业务系统

### 销售和客服执行链
- ✅ `sales-pipeline-v1` - 销售流程受控执行
- ✅ `support-resolution-v1` - 客服流程受控执行
- ✅ 人工审批点
- ✅ Durable state 管理

### Runtime Console
- ✅ Controlled run 查看和管理
- ✅ 审批操作界面
- ✅ 恢复和重试功能
- ✅ Governed trace 导出

---

## ⚠️ Beta 版本说明

**当前状态**: Local delivery demo ready

**适合场景**:
- ✅ 本地开发和测试
- ✅ 概念验证（POC）
- ✅ 小规模试用

**已知限制**:
- 真实 replay 功能正在完善
- 生产运维工具待增强
- Runtime UI 可控性视觉化待集成

**不适合场景**:
- ❌ 大规模生产部署（请等待正式版）

详细说明：[BETA_NOTES.md](https://github.com/aidi1723/agentcore-os/blob/main/BETA_NOTES.md)

---

## 📚 文档

- **安装指南**: [docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md](https://github.com/aidi1723/agentcore-os/blob/main/docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md)
- **项目框架**: [docs/PROJECT_FRAMEWORK.zh-CN.md](https://github.com/aidi1723/agentcore-os/blob/main/docs/PROJECT_FRAMEWORK.zh-CN.md)
- **开发手册**: [docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md](https://github.com/aidi1723/agentcore-os/blob/main/docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- **文档索引**: [docs/DOCUMENTATION_INDEX.zh-CN.md](https://github.com/aidi1723/agentcore-os/blob/main/docs/DOCUMENTATION_INDEX.zh-CN.md)

---

## 🔧 技术栈

- React 19.0.0
- Next.js 15.5.20
- TypeScript (strict mode)
- Node.js >=20 <25

---

## 📦 安装

### 要求
- Node.js >=20 <25
- macOS (当前主要支持平台)

### 步骤

```bash
# 克隆仓库
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

详细安装说明：[docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md](https://github.com/aidi1723/agentcore-os/blob/main/docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md)

---

## 🐛 问题反馈

遇到问题或有建议？

- **Bug 报告**: [提交 Issue](https://github.com/aidi1723/agentcore-os/issues/new)
- **功能请求**: [提交 Issue](https://github.com/aidi1723/agentcore-os/issues/new)
- **一般讨论**: [Discussions](https://github.com/aidi1723/agentcore-os/discussions)

---

## 📈 下一步计划

### v1.3.0-beta.2 (2 周内)
- Runtime Console UI 集成（PipelineFlow/ApprovalCard）
- 小功能增强
- Bug 修复

### v1.3.0 正式版 (4-6 周后)
- Production hardening
- 真实 replay 完善
- 生产运维工具增强
- 性能优化

---

## 🙏 致谢

感谢所有早期测试者和贡献者！

您的反馈将帮助我们打造更好的产品。

---

## 📄 完整更新日志

查看完整更新日志：[CHANGELOG.md](https://github.com/aidi1723/agentcore-os/blob/main/CHANGELOG.md)

---

**AgentCore OS 团队**  
2026-09-12

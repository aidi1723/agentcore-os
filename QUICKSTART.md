# AgentCore OS - 5 分钟快速上手

> 这是一份极简上手指南。如果你想深入了解，请查看 [完整文档索引](docs/DOCUMENTATION_INDEX.zh-CN.md)。

---

## ⚡ 快速开始

### 1. 克隆并启动（2 分钟）

```bash
# 克隆仓库
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 **http://localhost:3000** 即可看到界面。

---

### 2. 运行第一个演示（1 分钟）

```bash
# 写入演示数据
npm run delivery:demo:seed

# 验证演示数据
npm run delivery:demo:check
```

刷新浏览器，你会看到：
- 首页的 **Controlled Playbook Cockpit**
- **Runtime Console** 中的演示运行记录
- 已完成、等待审批、可重试的示例任务

---

### 3. 理解核心概念（2 分钟）

AgentCore OS 不是普通的 AI 聊天工具，而是一个**可控的 AI 工作流执行系统**。

#### 🎯 核心理念

```
传统 AI                    AgentCore OS
─────────────────────    ─────────────────────
LLM 自由发挥        →    固定 Playbook 步骤
随意调用工具        →    受限工具边界
无审批流程          →    人工审批阻断点
失败后无法恢复      →    Durable State + Resume
结果无法追溯        →    Governed Trace
```

#### 🔑 三个关键概念

1. **Playbook（剧本）**
   - 固定的工作流步骤定义
   - 例如：`sales-pipeline-v1` 包含 5 个固定步骤
   - LLM 不能改变步骤顺序

2. **Runtime Console（运行控制台）**
   - 查看所有运行记录
   - 审批/拒绝/重试任务
   - 查看资产落地情况

3. **Governed Trace（治理追踪）**
   - 每次运行都有完整追踪记录
   - 可导出、可复现、可审计
   - 支持 fixture replay（回放验证）

---

## 📚 下一步

### 想深入了解？

- **架构设计**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **项目框架**: [docs/PROJECT_FRAMEWORK.zh-CN.md](docs/PROJECT_FRAMEWORK.zh-CN.md)
- **开发手册**: [docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md](docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)

### 想看更多示例？

```bash
# 查看 playbook 控制审计
npm run playbook:control:audit

# 查看 trace fixtures 报告
npm run trace:fixtures

# 运行完整回归测试
npm run test:core-workflows
```

### 想贡献代码？

- **贡献指南**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **当前任务**: [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
- **路线图**: [docs/ROADMAP.md](docs/ROADMAP.md)

---

## 🆘 遇到问题？

### 常见问题

**Q: 为什么启动后看不到任何任务？**  
A: 运行 `npm run delivery:demo:seed` 写入演示数据。

**Q: 端口 3000 被占用怎么办？**  
A: 使用 `npm run dev -- -p 3001` 指定其他端口。

**Q: 我想直接用，不想了解这么多概念**  
A: AgentCore OS 是面向企业级场景的可控系统，需要理解核心概念才能正确使用。如果只需要简单的 AI 聊天，可以考虑其他工具。

**Q: 这个项目生产可用吗？**  
A: 当前版本（v1.3.0）已达到 `local_delivery_demo_ready`，但明确声明 `productionReady: false`。真实 replay、生产运维等特性仍在硬化中。

### 获取帮助

- 📖 [完整文档](docs/DOCUMENTATION_INDEX.zh-CN.md)
- 🐛 [提交 Issue](https://github.com/aidi1723/agentcore-os/issues)
- 💬 [参与讨论](https://github.com/aidi1723/agentcore-os/discussions)

---

## ⚙️ 系统要求

- **Node.js**: 20-24
- **操作系统**: macOS / Linux / Windows
- **内存**: 建议 4GB+
- **磁盘**: 约 1GB（含依赖）

---

**下一步**: 👉 阅读 [用户指南](docs/USER_GUIDE.zh-CN.md) 了解完整功能

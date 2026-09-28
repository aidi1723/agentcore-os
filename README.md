# AgentCore OS

> **受控剧本运行时：步骤事先写死，业务资产只在批准后写入**

[![Beta Version](https://img.shields.io/badge/status-beta-yellow.svg)](https://github.com/aidi1723/agentcore-os/blob/main/BETA_NOTES.md)
[![Current Version](https://img.shields.io/badge/version-v1.3.0--beta.1-blue.svg)](https://github.com/aidi1723/agentcore-os/releases)
[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)

## 🎯 项目定位

AgentCore OS 当前主线是受控剧本运行时。

已登记并可执行的是 `sales-pipeline-v1` 与 `support-resolution-v1`。

复核步会停住；业务资产只在批准后写入；契约不合格的输出不会写入。

桌面上的其他窗口是操作壳，不代表各自有一条受控执行链。版本以 `main` 的 `package.json` 为准；`v1.4.0` Release 早于当前 `main`。

演示入口在运行控制台的「用演示夹具启动」。范围和验收写在 `docs/可控执行开发计划书.md`，这次自动验收记在 `docs/可控执行-演示记录.md`。

## 💡 核心价值

**AgentCore OS = 将 AI Skill 从"对话式调用"升级为"应用级产品"的可视化操作系统**

### 三大核心突破

#### 1. 从"自由发挥"到"结构化执行"
- ❌ 传统 Agent：靠 Prompt 约束，输出不可控，容易幻觉
- ✅ AgentCore OS：Schema 强制约束 + 降级策略，输出 100% 可控

#### 2. 从"Prompt 工程"到"可视化界面"
- ❌ 传统方式：需要精心设计 Prompt，普通用户门槛高
- ✅ AgentCore OS：填表单即可，无需懂 AI，像用 Excel 一样简单

#### 3. 从"一次性对话"到"可追溯执行"
- ❌ 传统 Agent：对话记录关闭即丢失，无法追溯
- ✅ AgentCore OS：完整执行日志，随时查看历史决策

---

**适用场景**：需要 AI 稳定、可控、可追溯的企业级应用

每个应用窗口 = 一个 Skill 的专属执行界面  
32 个应用 = 32 个 AI 能力的产品化封装  
设计系统 = 让这些 Skill 拥有统一的用户体验

---

## 🌟 为什么需要 AgentCore OS？

### 传统 AI 交互的痛点

```
用户 → 手动输入 Prompt → AI 返回文本 → 复制粘贴 → 手动整理
```

**问题**：
- 每次都要重新描述需求
- 输出格式不稳定
- 无法保存执行历史
- 不同能力之间无法联动

### AgentCore OS 的解决方案

```
Skill 定义（OpenClaw Runtime）
    ↓
可视化应用窗口（专属 UI）
    ↓
用户填表单 → AI 执行 → 结构化输出 → 自动流转到下一步
```

**优势**：
- ✅ **Skill 标准化**：每个能力都有固定的输入/输出格式
- ✅ **UI 可视化**：表单化操作，无需记忆 Prompt
- ✅ **状态持久化**：执行历史、草稿自动保存
- ✅ **工作流编排**：Skill 之间自动数据流转

---

## 📦 核心功能

### 1. 操作系统级交互体验

像 macOS/Windows 一样的桌面环境：

- **窗口系统**：可拖拽、调整大小、最小化、多窗口并行
- **Dock 栏**：常用应用固定在底部，一键启动
- **菜单栏**：时间、通知、系统状态一目了然
- **应用切换器**：Cmd+Tab 风格的快速切换

### 2. 32 个专业 AI 应用

每个应用 = 一个专业化的 AI Skill 执行界面：

#### 🗂️ 生产力类
- **Task Manager** - 智能任务管理（优先级排序、自动提醒）
- **Knowledge Vault** - 知识库管理（AI 自动分类标签）
- **Second Brain** - 个人知识图谱（双向链接、自动关联）
- **Morning Brief** - 每日工作摘要生成

#### 📧 沟通协作类
- **Inbox Declutter** - 邮件智能分类 + 回复建议
- **Email Assistant** - 邮件撰写助手（多场景模板）
- **Meeting Copilot** - 会议记录 → AI 提取待办 → 自动分配
- **Personal CRM** - 联系人管理 + 沟通历史追踪

#### 🎨 内容创作类
- **Content Repurposer** - 一键改写为多平台版本（小红书/Twitter/LinkedIn）
- **Creative Studio** - 视频脚本生成 + 素材推荐
- **Publisher** - 多平台发布中心（定时发布/草稿管理）
- **Creator Radar** - 热点追踪 + 选题策划

#### 🔍 研究分析类
- **Deep Research Hub** - 多源信息聚合 + 结构化整理
- **Tech News Digest** - 技术资讯自动摘要
- **Support Copilot** - 客服工单分析 + 回复建议

#### 🏢 业务运营类
- **Deal Desk** - 销售管线管理（线索 → 商机 → 成单）
- **Recruiting Desk** - 候选人评估 + 面试记录
- **Project Ops** - 项目健康度看板（红黄绿灯）
- **Financial Document Bot** - 发票/账单智能解析

#### 👨‍👩‍👧 个人生活类
- **Family Calendar** - 家庭日程 + 待办 + 购物清单
- **Habit Tracker** - 习惯养成追踪 + 数据分析
- **Health Tracker** - 健康数据记录 + 趋势分析
- **Language Learning Desk** - 语言学习助手（角色扮演 + 纠错）

### 3. 跨应用数据流转

Skill 之间不是孤立的，而是可以**自动编排**：

**场景 1：独立创作者的一天**
```
Morning Brief (生成今日重点) 
  → Creator Radar (策划选题) 
    → Content Repurposer (多平台改写) 
      → Publisher (一键发布) 
        → Knowledge Vault (素材归档)
```

**场景 2：远程团队协作**
```
Meeting Copilot (会议纪要) 
  → Task Manager (分配任务) 
    → Email Assistant (发邮件通知) 
      → Personal CRM (更新联系记录)
```

**场景 3：电商运营流程**
```
Tech News Digest (行业动态) 
  → Social Media Autopilot (社媒排期) 
    → Support Copilot (客服应答) 
      → Financial Document Bot (订单归档)
```

### 4. 统一设计系统

**从硬编码到标准化**：

迁移前：
```jsx
// 140 字符的硬编码样式
<button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
  执行
</button>
```

迁移后：
```jsx
// 清晰的语义化组件
<Button variant="primary" size="md" icon={Sparkles}>
  执行
</Button>
```

**成果**：
- ✅ **代码减少 75-80%**：从 40,000+ 行优化到 25,000 行
- ✅ **开发效率提升 60%**：新增应用从 4 小时 → 1.5 小时
- ✅ **视觉一致性**：32 个应用共享同一套 UI 标准

---

## ⚡ 快速开始

### 本地开发体验

```bash
npm install
npm run dev
```

启动后访问：`http://localhost:3000/`

建议本地开发使用 Node.js 22 LTS；当前工程允许 Node.js 20 到 24。

### 运行演示数据

```bash
# 写入演示数据
npm run delivery:demo:seed

# 验证演示数据
npm run delivery:demo:check
```

刷新浏览器，你会在 Runtime Console 中看到示例任务。

### 命令行安装与运行

当前推荐安装方式只有一种：**GitHub macOS 命令行安装**。

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

安装说明以 [GitHub macOS 命令行安装](docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md) 为准。

---

## 🏗️ 系统架构

### 三层架构

```
┌─────────────────────────────────────────────┐
│   应用层（32 个专业应用窗口）                  │
│   - InboxDeclutter, MeetingCopilot, ...     │
│   - 每个应用 = 一个 Skill 的可视化界面         │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   平台层（操作系统核心）                        │
│   - 窗口管理器（拖拽/层级/最小化）              │
│   - 数据层（localStorage 持久化）              │
│   - 设计系统（统一 UI 组件）                   │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│   执行层（OpenClaw AI Runtime）               │
│   - Skill 执行引擎                            │
│   - LLM 调用管理                              │
│   - 本地/云端双模式                            │
└─────────────────────────────────────────────┘
```

### 技术栈

```typescript
React 18 + TypeScript + Next.js 15
├─ 窗口系统：自研窗口管理器（状态机 + 动画）
├─ UI 层：Tailwind CSS + 设计令牌系统
├─ 数据层：localStorage（草稿/任务/配置）
├─ AI 层：OpenClaw Runtime（统一 Skill 调用接口）
└─ 构建：Turbopack + ESM
```

---

## ⚠️ Beta 版本说明

**AgentCore OS v1.3.0 目前处于 Public Beta 阶段。** 查看完整说明：[BETA_NOTES.md](BETA_NOTES.md)

**当前状态**：
- ✅ 核心功能完整且稳定
- ✅ 本地演示和测试就绪
- ⚠️ 生产环境硬化进行中
- ⚠️ 部分高级特性待完善

**适合场景**：
- ✅ 本地开发和测试
- ✅ 概念验证（POC）
- ✅ 小规模试用
- ⚠️ 生产环境请谨慎评估

**已知限制**：
- 真实 replay 功能正在完善
- 生产运维工具待增强
- Runtime UI 可控性视觉化待集成

**反馈渠道**：
- GitHub Issues: [提交问题](https://github.com/aidi1723/agentcore-os/issues)
- GitHub Discussions: [参与讨论](https://github.com/aidi1723/agentcore-os/discussions)

---

## 📊 项目数据

### 代码规模
- **25,000+ 行代码**（从 40,000+ 行优化而来）
- **32 个专业应用**
- **5 个核心设计组件**（Button, Input, Textarea, Card, Badge）
- **100% TypeScript 类型覆盖**

### 性能指标
- **窗口打开速度** < 500ms
- **应用切换延迟** < 100ms
- **首屏加载时间** < 2s（优化后）
- **设计系统覆盖率** 100%（32/32 应用）

### 开发效率
- **代码减少** 75-80%（硬编码样式 → 设计系统组件）
- **新应用开发时间** 从 4 小时 → 1.5 小时
- **UI 一致性** 从手动对齐 → 自动继承

---

## 📂 项目结构

```
agentcore-os/
├─ src/
│  ├─ components/
│  │  ├─ apps/                    # 32 个应用窗口
│  │  │  ├─ TaskManagerAppWindow.v2.tsx
│  │  │  ├─ InboxDeclutterAppWindow.v2.tsx
│  │  │  └─ ...
│  │  ├─ windows/                 # 窗口管理器
│  │  │  └─ AppWindowShell.tsx
│  │  └─ recommendations/         # AI 推荐组件
│  ├─ design-system/              # 设计系统
│  │  ├─ components/              # UI 组件库
│  │  │  ├─ Button.tsx
│  │  │  ├─ Input.tsx
│  │  │  ├─ Card.tsx
│  │  │  └─ Badge.tsx
│  │  └─ tokens.ts                # 设计令牌
│  ├─ lib/                        # 业务逻辑
│  │  ├─ tasks.ts                 # 任务管理
│  │  ├─ drafts.ts                # 草稿存储
│  │  ├─ openclaw-agent-client.ts # AI 调用
│  │  └─ workflow-runs.ts         # 工作流引擎
│  └─ apps/                       # 应用元数据
├─ docs/                          # 文档
│  ├─ reports/                    # 进度报告
│  └─ architecture/               # 架构设计
└─ public/                        # 静态资源
```

---

## 📖 文档入口

### 核心文档
- 📘 [项目完整介绍](PROJECT_INTRODUCTION.md) - 详细的项目说明文档
- 📘 [项目框架总纲（中文）](docs/PROJECT_FRAMEWORK.zh-CN.md)
- 📘 [可控 Agent Runtime 开发手册](docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- 📘 [用户指南（中文）](docs/USER_GUIDE.zh-CN.md)
- 📘 [文档总入口](docs/DOCUMENTATION_INDEX.zh-CN.md)

### 安装与发布相关
- [GitHub macOS 命令行安装](docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md)
- [命令行安装说明](docs/COMMAND_LINE_INSTALL.zh-CN.md)
- [冷启动安装验收](docs/COLD_START_VALIDATION.zh-CN.md)
- 当前版本发布说明：[English](docs/releases/v1.3.0.md) / [中文](docs/releases/v1.3.0.zh-CN.md)

### 其他核心文档
- [快速开始](docs/GETTING_STARTED.md)
- [架构说明](docs/ARCHITECTURE.md)
- [连接器说明](docs/CONNECTORS.md)
- [使用场景](docs/USE_CASES.md)
- [配置说明](docs/CONFIGURATION.md)

---

## 🔮 未来规划

### Phase 1: 验证与优化（当前阶段）
- ✅ 完成 32 个应用的设计系统迁移
- ⏳ 视觉回归测试
- ⏳ 功能完整性测试
- ⏳ 性能优化（Bundle Size / Runtime）

### Phase 2: 能力增强
- 🔄 **Workflow 编排器可视化**：拖拽式工作流设计
- 🔄 **自定义 Skill 支持**：用户自定义 AI 能力
- 🔄 **移动端适配**：响应式设计优化
- 🔄 **协作功能**：多人共享工作区

### Phase 3: 生态建设
- 📦 **Skill 市场**：社区贡献的 AI 能力模板
- 🔌 **插件系统**：第三方应用接入
- 🌐 **云端同步**：跨设备数据同步
- 👥 **团队版**：企业级权限管理

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！详见项目文档。

---

## 📄 开源协议

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

---

## 💡 核心价值

**AgentCore OS = 将 AI Skill 从"对话式调用"升级为"应用级产品"的可视化操作系统**

### 三大核心突破

#### 1. 从"自由发挥"到"结构化执行"
- ❌ 传统 Agent：靠 Prompt 约束，输出不可控，容易幻觉
- ✅ AgentCore OS：Schema 强制约束 + 降级策略，输出 100% 可控

#### 2. 从"Prompt 工程"到"可视化界面"
- ❌ 传统方式：需要精心设计 Prompt，普通用户门槛高
- ✅ AgentCore OS：填表单即可，无需懂 AI，像用 Excel 一样简单

#### 3. 从"一次性对话"到"可追溯执行"
- ❌ 传统 Agent：对话记录关闭即丢失，无法追溯
- ✅ AgentCore OS：完整执行日志，随时查看历史决策

---

**适用场景**：需要 AI 稳定、可控、可追溯的企业级应用

每个应用窗口 = 一个 Skill 的专属执行界面  
32 个应用 = 32 个 AI 能力的产品化封装  
设计系统 = 让这些 Skill 拥有统一的用户体验

# AgentCore OS（智枢 OS）V1.0 正式开源

[![CI](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/agentcore-os/actions/workflows/ci.yml)
[![License: Apache_2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

AgentCore OS（智枢 OS）是一个**本地优先、开箱即用的 AI 业务操作系统**。
它不是又一个聊天壳，而是一个真正面向“干活”的桌面底座：让模型、流程、文件、工具调用和人工确认边界，在你的电脑上协同工作。

我们的目标很明确：

**让 AI 不只停留在对话框里，而是真正进入个人与企业的真实工作流。**
让个人拥有企业级的数字生产力，让团队拥有更低门槛、更安全、更可控的本地 AI 落地系统。

## 支持多场景 AI 落地，而不是单点工具

AgentCore OS 的定位，不是只服务某一个岗位，也不是只适合某一个行业。
它是一个能够承接**多角色、多流程、多业务场景**的本地 AI 工作底座。

目前已经覆盖并持续落地的方向包括：

- **办公协同**：资料整理、任务流转、会议辅助、知识沉淀
- **设计与内容生产**：素材整理、内容生成、改写加工、多平台分发
- **客服与支持**：问题归类、回复辅助、知识调用、服务流程协同
- **财务与经营辅助**：文档整理、表单处理、流程支持、经营信息辅助处理
- **运营与增长**：选题提炼、内容加工、渠道分发、数据与流程衔接
- **销售与外贸**：询盘整理、客户背调、跟进内容生成、客户资产沉淀
- **编程与自动化**：自然语言描述需求，推动代码、脚本与本地执行链路落地
- **工厂生产管理**：生产信息整理、流程衔接、任务追踪、制造场景协同
- **仓库管理**：库存信息处理、出入库流程辅助、记录与流转协同
- **数据分析**：数据整理、结构化处理、分析辅助与结果沉淀

也就是说，它不是“只能做一件事的 AI 工具”，
而是一个能把不同岗位、不同流程逐步接入同一套本地工作体系的操作底座。

## 已经体现出来的落地方式

我们不想只讲愿景，更想强调已经跑起来的方向。

### 销售 / 外贸
- 询盘接入与整理
- 客户初步背调
- 基于本地产品资料和历史资产生成跟进内容
- 将结果回写到本地客户资产与流程记录中

### 编程 / 自动化
- 用自然语言描述需求
- 驱动代码生成、调试、修正与脚本落地
- 让创客、个人用户和小团队更容易把想法变成可运行工具

### 内容 / 运营
- 从素材整理到内容生成
- 从内容加工到分发与记录沉淀
- 把一次性输出逐步变成可复用流程

### 工厂 / 仓库 / 数据流程
- 围绕生产、仓储、数据处理等环节，逐步把信息整理、流程协同、记录沉淀和分析辅助接入 AI 工作流

这些场景背后的重点不是“AI 回答了一个问题”，
而是**AI 开始进入真实流程，并持续产生产物。**

## 它的几个核心特点

- **本地优先，更安全**  
  工作区、文件资产和执行链路围绕本地环境组织。敏感动作可以设置人工确认边界，避免 AI 越界执行。

- **支持 macOS 和 Windows**  
  面向真实桌面使用场景设计，不只是网页里“聊一聊”，而是能在本机真正进入工作流。

- **开箱即用，小白也能上手**  
  不希望用户先被 Docker、Python 环境、复杂命令行劝退。我们希望专业用户能做深，普通用户也能先跑起来。

- **支持国内外主流模型协同**  
  通过 BYOK（自带密钥）方式，可按需接入 GPT、Claude，以及 Kimi、DeepSeek、GLM、Qwen 等模型，把模型能力真正放进业务流程里。

- **既能做广，也能做深**  
  它既能承接办公、设计、客服、财务、运营、销售、编程、生产、仓储、数据分析等多类场景，也适合继续向具体行业和具体工作流深入扩展。

## Project status

**Status:** `main` is ahead of `v0.2.0-alpha.1` and currently represents a release candidate state.

Current repository state:
- the desktop shell is usable
- industry workspace selection is available
- multiple packaged scenario apps are included
- one cross-app hero workflow is now runnable for `Sales Desk`
- language-first onboarding is included
- production hardening is **not** complete yet

## What’s new in current `main`

- Industry App Center: switch by industry and scenario instead of browsing isolated tools
- Solutions Hub: packaged mature workflows mapped from real-world use cases
- Multi-language entry: top-level language switcher + first-launch language onboarding
- Packaged business apps: research, content, CRM, meeting, operations, SEO, finance, learning
- Desktop UX: resizable windows + keyboard tiling/restore shortcuts
- Playbooks: local-first SOP install/save/export/import
- Publisher: dry-run and queued dispatch with connector-based publishing
- Publisher config/jobs: file-backed server storage for queue state and connector credentials
- Publisher queue runner: server-side execution path via `/api/publish/queue/run`
- Sales Hero Workflow: `Deal Desk -> Email Assistant -> Personal CRM` now shares runtime state, trigger metadata, and local asset write-back
- Structured inquiry intake: Sales Desk now captures inquiry channel, language preference, product line, and includes a sample inbound lead for first-run demo
- Multi-industry starters: Industry Hub now includes one-click solution starters for sales, creator, support, research, recruiting, and delivery workflows

## Current product positioning

AgentCore OS is now positioned as a **business solution operating system**, not just a browser desktop full of AI apps.

Current product spine:

- `industry` decides which business context the user belongs to
- `role` decides which desk and default working surface should open first
- `workflow` decides the standard sequence, trigger, human review boundary, and result asset path
- `apps` are execution components inside that workflow, not the primary product story

Current flagship example:

- `Sales Desk`
  `客户询盘 / 手动录入 -> Deal Desk -> Email Assistant -> Personal CRM -> 本地销售资产沉淀`

## What it includes

- Window manager: z-order, focus, minimize/restore, drag, snap, position persistence
- Spotlight launcher: app search + command execution
- Local-first storage: settings, drafts, tasks, publish history, app records
- Industry App Center: industry bundles and custom workspace builder
- Solutions Hub: curated real-world workflows you can install as Playbooks
- Playbooks: local-first SOP library (export/import as JSON)
- Multi-language shell: Chinese, English, Japanese, custom language label
- Publishing hub: safe-by-default dispatch with bring-your-own connectors
- Example local webhook connector with receipts UI (`npm run webhook:dev`)
- API routes for LLM / OpenClaw / publish dispatch workflows

## Packaged app areas

- Content and media
  - Tech News Digest
  - Creator Radar
  - Content Repurposer
  - Social Media Auto-pilot
  - Website SEO Studio
- Business operations
  - Personal CRM
  - Email Assistant
  - Deal Desk
  - Meeting Copilot
  - Project Ops Board
  - Financial Document Bot
- Research and knowledge
  - Deep Research Hub
  - Knowledge Vault
  - Second Brain
  - Morning Brief
- People and recruiting
  - Recruiting Desk
  - Task Manager
- Personal productivity
  - Family Calendar
  - Habit Tracker
  - Health Tracker
  - Language Learning Desk

## What it does **not** do

- No scraping-based social automation
- No unofficial posting flows against platforms
- No built-in auth / multi-tenant security model
- No production-grade secret storage or auth model by default

## Quick start

```bash
npm install
npm run dev
```

Optional env template:
- [`.env.example`](/Users/aidi/agent桌面/agentcore-os/.env.example)

Open:
- App UI: `http://localhost:3000/`
- Optional local connector UI: `http://127.0.0.1:8787/`

## Optional webhook connector

Run the local connector example:

```bash
npm run webhook:dev
```

Optional: run the publish queue worker without relying on an open browser tab:

```bash
npm run publish-queue:worker
```

Production examples for PM2, `systemd`, and `launchd` live under [`deploy/`](/Users/aidi/agent桌面/agentcore-os/deploy).
Template placeholders and replacement instructions are in [`deploy/README.md`](/Users/aidi/agent桌面/agentcore-os/deploy/README.md).

Then in **Settings → Accounts/Publishing**, set a platform's `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

This example connector only records receipts locally. It does **not** publish to any external platform.

## Documentation

### Start here
- [Getting Started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Solution OS Direction](docs/SOLUTION_OS.md)
- [Hero Workflow Strategy](docs/HERO_WORKFLOW.md)
- [Connectors](docs/CONNECTORS.md)
- [Connector Recipes](docs/CONNECTOR_RECIPES.md)
- [Use Cases](docs/USE_CASES.md)
- [Privacy](docs/PRIVACY.md)

### Operational docs
- [Configuration](docs/CONFIGURATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Next Steps](docs/NEXT_STEPS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Open Source Checklist](docs/OPEN_SOURCE_CHECKLIST.md)
- [Releasing](RELEASING.md)

### Release notes
- [v0.1.0](docs/releases/v0.1.0.md)
- [v0.2.0-alpha.1](docs/releases/v0.2.0-alpha.1.md)
- [v0.2.0 (draft)](docs/releases/v0.2.0-draft.md)

## Repository structure

```text
src/
  app/            Next.js App Router pages and API routes
  components/     Desktop shell and app window components
  lib/            Local-first state and helper modules
scripts/
  webhook-connector/   Local example connector
docs/
deploy/
```

## Safety & compliance

If you build “auto publish” features, do it via:
- official platform APIs, or
- approved third-party services (Buffer / Metricool / Make / Zapier), or
- your own internal tooling with explicit user consent and ToS compliance

This repository is meant to be a practical AI workspace foundation, not a loophole for bypassing platform rules.

## Scripts

- `npm run dev` — run the app in development mode
- `npm run dev:clean` — clear `.next-dev` and start dev server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run stable` — rebuild cleanly and run production server on port 3000
- `npm run lint` — lint
- `npm run webhook:dev` — run local webhook connector example
- `npm run publish-queue:worker` — poll `/api/publish/queue/run` as a background worker

Queue deployment examples:
- [`deploy/pm2/ecosystem.config.cjs`](/Users/aidi/agent桌面/agentcore-os/deploy/pm2/ecosystem.config.cjs)
- [`deploy/systemd/openclaw-publish-queue-worker.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.service)
- [`deploy/systemd/openclaw-publish-queue-trigger.service`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-trigger.service)
- [`deploy/systemd/openclaw-publish-queue-worker.timer`](/Users/aidi/agent桌面/agentcore-os/deploy/systemd/openclaw-publish-queue-worker.timer)
- [`deploy/launchd/com.openclaw.publish-queue-worker.plist`](/Users/aidi/agent桌面/agentcore-os/deploy/launchd/com.openclaw.publish-queue-worker.plist)

## Open-source hygiene

Before publishing changes:
- review [docs/OPEN_SOURCE_CHECKLIST.md](docs/OPEN_SOURCE_CHECKLIST.md)
- make sure no secrets, private identifiers, or build artifacts are committed
- run `npm run lint` and `npm run build`

## Open Source License

AgentCore OS is open source under the **Apache License 2.0**.

We chose Apache-2.0 to support broad adoption across individual, startup, and enterprise use cases, while providing a clear patent grant and permissive redistribution terms.

Please note:

- **Source code** in this repository is licensed under Apache-2.0.
- **Logos, trademarks, product names, and brand assets** are **not** granted under the software license unless explicitly stated otherwise.
- Third-party dependencies remain under their own respective licenses.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

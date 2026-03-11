# OpenClaw OS — Industry AI Workspace

[![CI](https://github.com/aidi1723/openclaw-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aidi1723/openclaw-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Next.js + Tailwind **desktop-style AI workspace** that runs in the browser.

It combines a desktop shell, industry workspaces, scenario-based app bundles, local-first state,
and AI-powered workflow apps into a single entry point.

The project is no longer just a UI shell. It is now aimed at giving non-technical users a fast way
to enter real-world AI workflows by opening packaged apps instead of assembling tools from scratch.

## Project status

**Status:** `main` is ahead of `v0.2.0-alpha.1` and currently represents a release candidate state.

Current repository state:
- the desktop shell is usable
- industry workspace selection is available
- multiple packaged scenario apps are included
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
- No secure secret storage by default (this demo stores settings in browser localStorage)

## Quick start

```bash
npm install
npm run dev
```

Open:
- App UI: `http://localhost:3000/`
- Optional local connector UI: `http://127.0.0.1:8787/`

## Optional webhook connector

Run the local connector example:

```bash
npm run webhook:dev
```

Then in **Settings → Accounts/Publishing**, set a platform's `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

This example connector only records receipts locally. It does **not** publish to any external platform.

## Documentation

### Start here
- [Getting Started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Connectors](docs/CONNECTORS.md)
- [Connector Recipes](docs/CONNECTOR_RECIPES.md)
- [Use Cases](docs/USE_CASES.md)
- [Privacy](docs/PRIVACY.md)

### Operational docs
- [Configuration](docs/CONFIGURATION.md)
- [Deployment](docs/DEPLOYMENT.md)
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

## Open-source hygiene

Before publishing changes:
- review [docs/OPEN_SOURCE_CHECKLIST.md](docs/OPEN_SOURCE_CHECKLIST.md)
- make sure no secrets, private identifiers, or build artifacts are committed
- run `npm run lint` and `npm run build`

## License

MIT. See [LICENSE](LICENSE).

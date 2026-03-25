# openclaw-os

Local-first OpenClaw control panel built with Next.js. It gives you one UI for taskboard summary, OpenClaw status, skills browsing, logs, social-ops mock runs, and automation stubs without requiring a remote backend.

## Current stable version

Current release line: **v1.0.0**

This is the first stable baseline for `openclaw-os` as a conservative local desktop shell:
- local-first
- explicit mock/stub boundaries
- no silent publish behavior
- validated by `test`, `lint`, and `build`

## What it is

`openclaw-os` is a local dashboard for an existing OpenClaw workspace. The app reads files and CLI output from your machine and presents them in a stable UI shell.

Current modules:
- **Taskboard** — summarize today time, top tasks, and top projects from local taskboard files with bounded backward log scans
- **Social Ops** — mock-only brief → script → shotlist → captions flow, with no publishing
- **Automations** — automation catalog and detail stubs
- **Gateway / Nodes** — OpenClaw CLI status views
- **Skills** — browse `SKILL.md` files from the local workspace
- **Logs** — view recent memory markdown files from the local workspace

## Product boundary

This app is intentionally conservative:
- Social Ops stays in **safe mode** by default
- Automation execution is **not implemented**
- No route auto-publishes content to third-party platforms
- Local file reads and CLI status checks are the primary data sources

If something is not implemented yet, the UI and API should say so explicitly instead of pretending to do real work.

## Requirements

- Node.js 24+
- npm
- A local OpenClaw workspace
- `openclaw` CLI available in `PATH` for gateway/node status pages

## Configuration

The app reads these environment variables:

- `OPENCLAW_HOME` — defaults to `~/.openclaw`
- `OPENCLAW_WORKSPACE` — defaults to `$OPENCLAW_HOME/workspace`
- `OPENCLAW_OS_DATA_DIR` — defaults to `$OPENCLAW_WORKSPACE/openclaw-os-data`
- `OPENCLAW_TASKBOARD_UI_URL` — defaults to `http://127.0.0.1:5173/taskboard/index.html`

### Expected workspace layout

At minimum, these paths are used:

```text
$OPENCLAW_WORKSPACE/
├── memory/
│   └── YYYY-MM-DD.md
├── skills/
│   └── <skill>/SKILL.md
└── taskboard/
    ├── tasks.json
    └── time_log.jsonl
```

Runtime data written by this app:

```text
$OPENCLAW_OS_DATA_DIR/
├── social_ops_config.json
└── social_ops_runs.jsonl
```

## Development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Validation commands

Lint:

```bash
npm run lint
```

Tests:

```bash
npm run test
```

Production build:

```bash
npm run build
npm run start
```

## Key routes

- `/` — desktop shell
- `/taskboard` — today summary from local taskboard JSON/JSONL
- `/social-ops` — mock content pipeline
- `/automations` — automation list
- `/gateway` — `openclaw status --deep` style status view
- `/nodes` — node status view
- `/skills` — local skills browser
- `/logs` — recent memory/log view

## API routes

- `GET /api/openclaw-status` — lightweight polled status with short cache
- `GET /api/taskboard-summary` — taskboard summary JSON
- `GET /api/skills` — local skills list
- `GET /api/social-ops` — social-ops config + recent runs
- `POST /api/social-ops` — `saveConfig` and `mockRun` with input validation
- `POST /api/automation` — explicit 501 automation stub contract

## Common failures

### Missing workspace files

If `taskboard/tasks.json`, `taskboard/time_log.jsonl`, `memory/`, or `skills/` are missing, the related page or API returns a readable error instead of crashing the whole app.

### `openclaw` command not found

Gateway and node pages depend on the local CLI. If it is missing from `PATH`, those pages will show the command error.

### Empty or invalid JSONL

JSONL readers ignore malformed lines where possible. This keeps dashboards usable even if a log file contains partial corruption.

### Large taskboard logs

Taskboard summary starts from the tail of `taskboard/time_log.jsonl` and scans backward in bounded chunks until it covers today's boundary. This avoids routine full-file reads while keeping same-day totals accurate.

## Release checklist

Before calling the app stable:

```bash
npm run lint
npm run test
npm run build
```

Also verify manually that:
- pages load on a non-default port without hardcoded self-fetch URLs
- Taskboard, Skills, Logs, Gateway, and Nodes either load real data or show clear errors
- Social Ops remains mock-only and does not publish
- Automation endpoints/pages clearly show not-implemented state

See also:
- [CHANGELOG.md](CHANGELOG.md)

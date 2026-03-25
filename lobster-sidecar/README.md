# Lobster Sidecar

This is an independent Python sidecar adapter for AgentCore OS desktop builds.

Why it exists:

- The checked-out `lobster-src/` repo is an Electron desktop app, not a Python HTTP service.
- AgentCore OS desktop mode needs a local HTTP sidecar contract.
- This adapter gives Tauri a stable local backend to talk to first, then you can bridge real Lobster capabilities behind it.

Current responsibilities:

- health check
- heartbeat/self-termination
- runtime diagnostics
- runtime sidecar config persistence
- executor session list/detail persistence
- runtime state persistence for:
  - deals
  - support tickets
  - workflow runs
- publish config persistence
- publish queue/job persistence
- `/api/openclaw/agent` execution bridge with unified executor-history recording
- IM bridge for DingTalk / Feishu / generic webhook remote commands

Not yet implemented:

- a fully separate skill planner/runtime beyond the current AgentCore prompt-guided execution path
- long-running distributed execution orchestration
- stronger cross-process JSON locking/hardening comparable to the Next mainline store
- full production package verification across every desktop OS combination

Run in development:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080
```

Recommended build Python:

- prefer Python `3.11` or `3.12` for release sidecar packaging
- Python `3.14+` may work, but the PyInstaller hook chain is less predictable

Package example:

```bash
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
npm run desktop:package
```

Notes:

- `desktop:build-sidecar` writes PyInstaller cache into `./.cache/pyinstaller` so it does not depend on the user profile directory.
- `desktop:build-sidecar` can fall back to `python -m PyInstaller` if the standalone launcher is missing from `PATH`.
- `tauri`, `tauri:dev`, and `tauri:build` resolve `cargo` from common install locations such as `~/.cargo/bin` when `PATH` is incomplete.

## IM bridge endpoints

- `GET /api/im-bridge/config`
- `PUT /api/im-bridge/config`
- `GET /api/im-bridge/health`
- `POST /api/im-bridge/test`
- `POST /api/im-bridge/inbound/{provider}`

Where `provider` is one of:

- `generic`
- `feishu`
- `dingtalk`

The desktop UI exposes these settings under `Settings -> Mobile Access`.

## Runtime parity endpoints

The sidecar now provides the desktop-shell parity routes required by the current AgentCore OS UI:

- `GET /api/runtime/executor/sessions`
- `GET /api/runtime/executor/sessions/{sessionId}`
- `GET /api/runtime/state/deals`
- `POST /api/runtime/state/deals`
- `DELETE /api/runtime/state/deals/{dealId}`
- `GET /api/runtime/state/support`
- `POST /api/runtime/state/support`
- `DELETE /api/runtime/state/support/{ticketId}`
- `GET /api/runtime/state/workflow-runs`
- `POST /api/runtime/state/workflow-runs`
- `DELETE /api/runtime/state/workflow-runs/{runId}`

These routes are covered by `npm run desktop:smoke-test-sidecar`.

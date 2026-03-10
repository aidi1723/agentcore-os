# OpenClaw OS — Web Desktop UI Framework

A Next.js + Tailwind **desktop-style UI framework** that runs in the browser.

It provides a window manager, launcher, “apps” registry, and a few example workflow apps
to help you build desktop-like productivity experiences on the web.

## Features

- Window manager: z-order, focus, minimize/restore, drag, snap, position persistence
- Spotlight launcher: app search + command execution
- Settings storage: local-first (localStorage) with event-based updates
- Tasks bus: lightweight global task list for async UX
- Drafts + publishing hub: safe-by-default “dispatch” with bring-your-own connectors
- Example connector server: local webhook receiver + receipts UI (`npm run webhook:dev`)

## Non-goals

- No direct automation against social platforms (no scraping / no unofficial posting)
- No built-in auth / multi-tenant security model (demo UI stores tokens locally)

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Webhook connector (optional)

Run the local connector example:

```bash
npm run webhook:dev
```

Connector UI: `http://127.0.0.1:8787/`

Then in WebOS: **Settings → Accounts/Publishing** set a platform’s `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

## Documentation

- `docs/GETTING_STARTED.md`
- `docs/ARCHITECTURE.md`
- `docs/CONNECTORS.md`
- `docs/CONFIGURATION.md`
- `docs/PRIVACY.md`
- `docs/DEPLOYMENT.md`
- `docs/TROUBLESHOOTING.md`
- `docs/ROADMAP.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

## Safety & compliance

If you build “auto publish” features, do it via:
- Official platform APIs, or
- Approved third-party services (Buffer/Metricool/Make/Zapier), or
- Your own internal tooling with explicit user consent and ToS compliance

## Scripts

- `npm run dev` – run the app
- `npm run build` – production build
- `npm run start` – run production server
- `npm run lint` – lint
- `npm run webhook:dev` – run local webhook connector example

## License

MIT. See `LICENSE`.

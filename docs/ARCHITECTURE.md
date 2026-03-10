# Architecture

## High-level

- Next.js App Router UI (`src/app`)
- “Desktop OS” page with window manager (`src/app/page.tsx`)
- App registry + manifests (`src/apps/registry.ts`, `src/apps/types.ts`)
- Window shell (`src/components/windows/AppWindowShell.tsx`)
- Local-first storage (`src/lib/settings.ts`, `src/lib/drafts.ts`, `src/lib/publish.ts`, `src/lib/tasks.ts`)
- API routes (server-side) for LLM/OpenClaw/publish dispatch (`src/app/api/**`)

## Window manager model

- Each app has an `AppId` and a window component (`AppWindowProps`)
- Window visibility uses `AppState`: `closed | opening | open | minimized | closing`
- Z-order is an array (`appZOrder`), last item is top-most
- Active window is tracked separately to render “active” styling
- Window shell persists drag offset via a `storageKey`

## “Apps”

An app is a manifest:

- `id`: stable identifier
- `name`: display name
- `icon`: lucide icon
- `window`: React component

This keeps the desktop UI generic while allowing you to plug in new apps quickly.

## Publishing flow

1) A draft is created/saved (localStorage)
2) Publisher selects platforms and calls `POST /api/publish/dispatch`
3) Server generates per-platform variants (OpenClaw if available, else fallback)
4) If “dispatch” mode and webhook URLs exist, server POSTs to webhooks (BYO connector)
5) Connector returns receipts; Publisher can show recent receipts via connector proxy routes


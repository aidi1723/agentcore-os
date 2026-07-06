# Delivery Demo Smoke Path Design

## Status

Approved design for turning the current controlled runtime branch into a repeatable local delivery demo path.

## Context

Runtime UI Reframing and Runtime Console Delivery Readiness Audit are complete. The current blocker is not another backend primitive; it is repeatability. A maintainer needs one commandable path that proves the product story:

Home cockpit -> Runtime Console -> controlled run detail -> approval/recovery/asset landing -> governed trace copy.

The repository already has durable local JSON stores under `.openclaw-data`, Runtime Console UI tests, controlled-runtime regression gates, governed trace artifacts, and build checks.

## Goal

Make a comprehensive local delivery smoke path that can be run before handoff to prove the controlled playbook product demo is usable and not just documented.

## Non-Goals

- Do not implement real LLM/tool replay.
- Do not add a new controlled playbook.
- Do not add public seed APIs.
- Do not mutate external systems or publish artifacts.
- Do not redesign the whole UI.
- Do not bypass approval, writeback, or trace governance boundaries.

## Delivery Scope

### 1. Deterministic Demo Data

Add a local script that seeds `.openclaw-data` with a small, explicit demo dataset:

- one completed `sales-pipeline-v1` controlled run with sales, knowledge, workflow, draft, and support asset receipts;
- one awaiting approval run;
- one retryable failed run;
- matching sales / knowledge / workflow / draft / support records where current app jumps need record focus.

The script must be idempotent by stable ids and source keys. It must avoid raw secrets in stored payloads.

### 2. Automated Smoke Assertion

Add a local script that checks the seeded state and route-level governed trace path:

- controlled run list contains the demo runs;
- completed run has expected asset landings;
- governed trace artifact for the completed run redacts raw input/output;
- retryable failed run keeps retry metadata;
- awaiting approval run exposes approval metadata.

This script is not a browser replacement, but it is the fast deterministic delivery gate.

### 3. Browser Smoke Path

Document a browser path:

1. Run the seed script.
2. Start the dev server.
3. Open Home.
4. Click `Open Runtime Console`.
5. Select/search the completed demo run.
6. Confirm asset landings render.
7. Copy governed trace.
8. Optionally trigger asset open actions.

If Playwright CLI is available, use it for visible assertions and screenshot evidence. If it is unavailable, the deterministic script plus unit/build gates remain the fallback.

### 4. Project Records

Update docs and records so maintainers know this is the active pre-delivery gate.

## Architecture

- `scripts/delivery-demo/seed-controlled-runtime-demo.mjs`
  - Writes local `.openclaw-data` JSON files through structured constants.
  - Uses stable ids prefixed with `delivery-demo`.
- `scripts/delivery-demo/check-controlled-runtime-demo.mjs`
  - Reads the local JSON state and imports governed trace helpers through the existing TypeScript alias loader.
  - Exits non-zero with clear diagnostics when demo data or trace governance is broken.
- `package.json`
  - Adds `delivery:demo:seed` and `delivery:demo:check`.
- `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`
  - Operator-facing handoff instructions.
- Tests
  - Add Vitest coverage for the script-owned demo data builder or smoke helper if shared functions are created.
  - Keep existing Runtime Console component tests in `test:controlled-runtime`.

## Verification

Required:

```bash
npm run delivery:demo:seed
npm run delivery:demo:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Browser verification:

```bash
npm run dev
# Use Playwright CLI or manual browser check:
# Home -> Open Runtime Console -> delivery demo run -> asset landings -> governed trace copy
```

Known accepted warning:

- `npm run lint` and `npm run build` may show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Acceptance Criteria

- A maintainer can seed and check the demo path with commands.
- Runtime Console has deterministic completed, awaiting approval, and retryable failed runs to inspect.
- Governed trace copy remains redacted.
- The docs state exactly how to run the delivery demo smoke path.
- The next phase may fix any browser-visible blocker found by the smoke path, but must not expand into real replay or a new playbook.

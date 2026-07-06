# Delivery Demo Smoke Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable local delivery demo smoke path for Home -> Runtime Console -> controlled run -> asset landing -> governed trace readiness.

**Architecture:** Add deterministic local scripts under `scripts/delivery-demo/` to seed and verify demo controlled-runtime data in `.openclaw-data`. Keep the scripts local-only and command-driven, then document the operator path and add the commands to the package scripts.

**Tech Stack:** Node.js ESM scripts, existing TypeScript alias loader, local JSON stores, Vitest for shared helper coverage, existing Next.js/React runtime and verification commands.

---

## File Structure

- Create `scripts/delivery-demo/demo-data.mjs`
  - Shared deterministic demo records and helpers.
- Create `scripts/delivery-demo/seed-controlled-runtime-demo.mjs`
  - Writes demo runs and related assets into `.openclaw-data`.
- Create `scripts/delivery-demo/check-controlled-runtime-demo.mjs`
  - Verifies seeded state and governed trace redaction.
- Create `src/__tests__/scripts/delivery-demo-data.test.ts`
  - Unit coverage for idempotent demo data shape and no raw secret payload.
- Modify `package.json`
  - Add `delivery:demo:seed` and `delivery:demo:check`.
  - Add the new test to `test:controlled-runtime`.
- Create `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`
  - Operator-facing smoke path guide.
- Modify `docs/NEXT_STEPS.md`, `docs/ROADMAP.md`, `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`, `README.md`, `CHANGELOG.md`
  - Record the new delivery gate and next action.
- Update this plan with completion notes.

---

### Task 1: Demo Data Builder And RED Tests

**Files:**
- Create: `scripts/delivery-demo/demo-data.mjs`
- Create: `src/__tests__/scripts/delivery-demo-data.test.ts`

- [x] **Step 1: Add failing tests**

Create `src/__tests__/scripts/delivery-demo-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDeliveryDemoData,
  DELIVERY_DEMO_COMPLETED_RUN_ID,
  DELIVERY_DEMO_FAILED_RUN_ID,
  DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
} from "../../../scripts/delivery-demo/demo-data.mjs";

describe("delivery demo data", () => {
  it("builds stable controlled runtime demo runs for completed, approval, and retry states", () => {
    const data = buildDeliveryDemoData({ now: 1_800_000_000_000 });

    expect(data.controlledRuns.map((run) => run.id)).toEqual([
      DELIVERY_DEMO_COMPLETED_RUN_ID,
      DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
      DELIVERY_DEMO_FAILED_RUN_ID,
    ]);
    expect(data.controlledRuns.map((run) => run.state)).toEqual([
      "completed",
      "awaiting_approval",
      "failed",
    ]);
    expect(data.controlledRuns[0].steps.at(-1)?.writebackReceipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
      "workflow_run",
      "draft",
      "support_asset",
    ]);
    expect(data.controlledRuns[1].steps.some((step) => step.approval?.state === "pending")).toBe(true);
    expect(data.controlledRuns[2].plan.steps.some((step) => step.onFailure?.action === "retry")).toBe(true);
  });

  it("keeps raw secrets out of demo records", () => {
    const serialized = JSON.stringify(buildDeliveryDemoData({ now: 1_800_000_000_000 }));

    expect(serialized).not.toMatch(/sk-/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toMatch(/nora@example\.com/i);
  });
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
npm test -- src/__tests__/scripts/delivery-demo-data.test.ts
```

Expected: FAIL because `scripts/delivery-demo/demo-data.mjs` does not exist.

- [x] **Step 3: Commit RED test**

```bash
git add src/__tests__/scripts/delivery-demo-data.test.ts
git diff --check --cached
git commit -m "test: specify delivery demo data"
```

---

### Task 2: Implement Demo Data Builder

**Files:**
- Create: `scripts/delivery-demo/demo-data.mjs`

- [x] **Step 1: Add demo data constants and builder**

Implement `buildDeliveryDemoData({ now })` with stable ids:

- `delivery-demo-run-completed`
- `delivery-demo-run-awaiting-approval`
- `delivery-demo-run-failed-retryable`
- `delivery-demo-workflow-sales`
- `delivery-demo-sales-asset`
- `delivery-demo-knowledge-asset`
- `delivery-demo-draft`
- `delivery-demo-support-asset`

Return object keys:

```js
{
  controlledRuns,
  salesAssets,
  knowledgeAssets,
  workflowRuns,
  drafts,
  supportAssets
}
```

- [x] **Step 2: Verify GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/delivery-demo-data.test.ts
```

Expected: PASS.

- [x] **Step 3: Commit builder**

```bash
git add scripts/delivery-demo/demo-data.mjs src/__tests__/scripts/delivery-demo-data.test.ts
git diff --check --cached
git commit -m "feat: add delivery demo data builder"
```

---

### Task 3: Seed And Check Scripts

**Files:**
- Create: `scripts/delivery-demo/seed-controlled-runtime-demo.mjs`
- Create: `scripts/delivery-demo/check-controlled-runtime-demo.mjs`
- Modify: `package.json`

- [x] **Step 1: Write seed script**

Create a local-only script that merges records into `.openclaw-data/*.json` by stable `id` or `sourceKey`, preserving unrelated records.

- [x] **Step 2: Write check script**

Create a check script that:

- reads `.openclaw-data/controlled-execution-runs.json`;
- verifies completed, awaiting approval, and failed retryable demo runs;
- verifies completed run writeback targets;
- builds governed trace artifact for the completed run and rejects raw unsafe text;
- exits `1` with diagnostics if any check fails.

- [x] **Step 3: Add npm scripts**

Add:

```json
"delivery:demo:seed": "node scripts/delivery-demo/seed-controlled-runtime-demo.mjs",
"delivery:demo:check": "node --import ./scripts/register-ts-alias-loader.mjs scripts/delivery-demo/check-controlled-runtime-demo.mjs"
```

- [x] **Step 4: Verify scripts**

Run:

```bash
npm run delivery:demo:seed
npm run delivery:demo:check
```

Expected: both exit 0.

- [x] **Step 5: Commit scripts**

```bash
git add package.json scripts/delivery-demo/seed-controlled-runtime-demo.mjs scripts/delivery-demo/check-controlled-runtime-demo.mjs
git diff --check --cached
git commit -m "feat: add delivery demo smoke scripts"
```

---

### Task 4: Gate Inclusion And Documentation

**Files:**
- Modify: `package.json`
- Create: `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: this plan

- [x] **Step 1: Include new test in controlled runtime gate**

Add `src/__tests__/scripts/delivery-demo-data.test.ts` to `test:controlled-runtime`.

- [x] **Step 2: Create delivery demo guide**

Document:

```bash
npm run delivery:demo:seed
npm run delivery:demo:check
npm run dev
```

Then browser path:

Home -> Open Runtime Console -> search `delivery-demo` -> select completed run -> inspect asset landings -> copy governed trace.

- [x] **Step 3: Align project docs**

Record Delivery Demo Smoke Path as completed and set next recommended phase to Browser Evidence And Release Readiness Sweep.

- [x] **Step 4: Run final verification**

Run:

```bash
git diff --check
npm run delivery:demo:seed
npm run delivery:demo:check
npm test -- src/__tests__/scripts/delivery-demo-data.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Expected: all exit 0. Existing `<img>` warning may remain.

- [x] **Step 5: Commit docs and gate inclusion**

```bash
git add package.json docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md docs/NEXT_STEPS.md docs/ROADMAP.md docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md README.md CHANGELOG.md docs/superpowers/specs/2026-07-06-delivery-demo-smoke-path-design.md docs/superpowers/plans/2026-07-06-delivery-demo-smoke-path.md
git diff --check --cached
git commit -m "docs: complete delivery demo smoke path"
```

---

## Completion Notes

Implementation status:

- `6d12bae` added the RED demo data test.
- `cd18b7f` added the deterministic demo data builder.
- `dbddeb0` added local delivery demo seed/check scripts, npm commands, and script helper coverage.
- `f331a38` added the delivery demo operator guide and aligned project docs.
- Documentation alignment completed in this plan, README, changelog, roadmap, next-stage backlog, documentation index, project framework, Runtime Console delivery audit, memory record, and `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`.

Final verification:

- `git diff --check` — exit 0.
- `npm run delivery:demo:seed` — exit 0; repeated run stayed idempotent.
- `npm run delivery:demo:check` — exit 0; `ok: true`, `diagnostics: []`.
- `npm test -- src/__tests__/scripts/delivery-demo-data.test.ts src/__tests__/scripts/delivery-demo-scripts.test.ts` — 2 files / 4 tests passed.
- `npm run test:controlled-runtime` — 38 files / 195 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.

Browser evidence follow-up:

- `npm run dev -- -p 3001` launched the local app because port 3000 was already occupied.
- Playwright smoke verified Home -> Runtime Console -> `delivery-demo-run-completed` -> five asset landings -> governed trace copy.
- Browser console errors: 0.
- Local screenshot: `output/playwright/delivery-demo-runtime-console.png`.

Current next phase after browser evidence:

- Governed Fixture And Playbook Expansion Review.

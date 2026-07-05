# Runtime Console Trace And Asset Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show controlled run trace, approval decisions, writeback receipts, and asset landing identifiers in the existing Runtime Console.

**Architecture:** Add a list endpoint for controlled runs, then keep UI display logic in a small tested summary helper before wiring it into `ClawRuntimeConsoleAppWindow`. Preserve the existing runtime console structure and design language.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, existing controlled execution store.

---

## Scope

Spec: [Runtime Console Trace And Asset Landing Design](../specs/2026-07-05-runtime-console-trace-asset-landing-design.md)

In scope:

- `GET /api/runtime/executor/controlled-runs`.
- Tested controlled run console summary helper.
- Runtime Console panel for recent controlled runs and selected run trace.
- Documentation and verification update.

Out of scope:

- Full UI redesign.
- Approval editing.
- New app windows or navigation.
- Deep asset router changes.

## File Structure

Create:

- `src/app/api/runtime/executor/controlled-runs/route.ts`
- `src/lib/executor/runtime/console-summary.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`

Modify:

- `src/__tests__/app/api/controlled-run-route.test.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `CHANGELOG.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-05.md`

---

### Task 1: Add Controlled Run List API

- [x] **Step 1: Write the failing route test**

Extend `src/__tests__/app/api/controlled-run-route.test.ts`:

```ts
import { GET as LIST } from "@/app/api/runtime/executor/controlled-runs/route";
```

Add:

```ts
it("lists recent controlled execution runs", async () => {
  await createControlledExecutionRun({
    id: "exec-list-1",
    requestId: "req-list-1",
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-list",
      goal: "list",
      totalSteps: 0,
      requiresApproval: false,
      steps: [],
    },
  });

  const response = await LIST(
    new Request("http://localhost/api/runtime/executor/controlled-runs"),
  );
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.ok).toBe(true);
  expect(data.data.runs.map((run: { id: string }) => run.id)).toContain("exec-list-1");
});
```

- [x] **Step 2: Verify it fails**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-route.test.ts
```

Expected: import fails because the list route does not exist.

- [x] **Step 3: Implement the route**

Create `src/app/api/runtime/executor/controlled-runs/route.ts`:

```ts
import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { listControlledExecutionRuns } from "@/lib/server/controlled-execution-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const runs = await listControlledExecutionRuns();
    return NextResponse.json(
      { ok: true, data: { runs } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load controlled runs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

- [x] **Step 4: Verify route test passes**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-route.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/api/runtime/executor/controlled-runs/route.ts src/__tests__/app/api/controlled-run-route.test.ts
git commit -m "feat: list controlled runs for runtime console"
```

### Task 2: Add Controlled Run Console Summary

- [x] **Step 1: Write failing unit tests**

Create `src/__tests__/lib/executor/runtime/console-summary.test.ts` covering:

- completed / awaiting / failed step counts,
- approval count,
- writeback receipt count,
- asset landing labels for `sales_asset` and `knowledge_asset`,
- step summary fields.

- [x] **Step 2: Verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: import fails because `console-summary.ts` does not exist.

- [x] **Step 3: Implement summary helper**

Create `src/lib/executor/runtime/console-summary.ts` with:

```ts
export function buildControlledRunConsoleSummary(run: ControlledExecutionRunRecord): ControlledRunConsoleSummary
```

The function must derive metadata and step summaries without fetching or mutating state.

- [x] **Step 4: Verify summary tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/console-summary.ts src/__tests__/lib/executor/runtime/console-summary.test.ts
git commit -m "feat: summarize controlled runs for console"
```

### Task 3: Wire Runtime Console Panel

- [x] **Step 1: Add controlled run state and fetchers**

Modify `src/components/apps/ClawRuntimeConsoleAppWindow.tsx` to fetch `/api/runtime/executor/controlled-runs`, select the first run by default, and build summaries with `buildControlledRunConsoleSummary`.

- [x] **Step 2: Render controlled run panel**

Add a panel labeled `受控运行 Trace` with recent run list and selected step trace. Show:

- playbook id,
- run state,
- current step,
- completed / awaiting / failed counts,
- approvals,
- writeback receipts,
- asset landing labels.

- [x] **Step 3: Verify controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/apps/ClawRuntimeConsoleAppWindow.tsx
git commit -m "feat: show controlled run trace in runtime console"
```

### Task 4: Final Verification And Docs

- [x] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Expected: all pass; lint/build may keep the existing `<img>` warning.

- [x] **Step 2: Update docs and memory**

Update changelog, development manual, this plan checklist, and daily memory with the final verification.

- [x] **Step 3: Commit docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-05-runtime-console-trace-asset-landing.md
git commit -m "docs: track runtime console trace landing"
```

## Self-Review

- Spec coverage: route, summary model, UI panel, verification, and docs are covered.
- Placeholder scan: no `TBD` or open implementation placeholders.
- Type consistency: all tasks use existing `ControlledExecutionRunRecord` and route response conventions.

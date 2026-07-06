# Trace Governance Console Export And Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Runtime Console export governed trace artifacts and add a conservative raw controlled-run prune helper.

**Architecture:** Keep raw run operations on the existing controlled-runs route. Extend the governed trace artifact route with export metadata, add a console copy action that consumes only that route, and add a pure store-level prune helper that removes old terminal runs while keeping active runs.

**Tech Stack:** TypeScript, Next.js route handlers, React, Vitest, Testing Library, existing controlled runtime store and Runtime Console component.

---

## File Structure

- Modify `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`: include export metadata in the governed route response.
- Modify `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`: assert export metadata and continued redaction.
- Modify `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`: add selected-run governed trace copy action.
- Modify `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`: prove console export uses the governed route and copies redacted JSON.
- Modify `src/lib/server/controlled-execution-store.ts`: add retention policy type and prune helper.
- Modify `src/__tests__/lib/server/controlled-execution-store.test.ts`: prove prune behavior.
- Modify `docs/NEXT_STEPS.md`, `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`, `CHANGELOG.md`, and this plan after verification.

---

### Task 1: Artifact Route Export Metadata

**Files:**
- Modify: `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`
- Modify: `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`

- [x] **Step 1: Write failing route metadata test**

Extend the successful route test with:

```ts
expect(data.data.export).toMatchObject({
  contentType: "application/json",
  governanceMode: "fixture",
});
expect(data.data.export.filename).toMatch(/^controlled-trace-exec-artifact-1-\d+\.json$/);
expect(typeof data.data.export.generatedAt).toBe("number");
expect(data.data.artifact.id).toBe("exec-artifact-1");
```

- [x] **Step 2: Run route test to verify RED**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
```

Expected: FAIL because `data.data.export` does not exist yet.

- [x] **Step 3: Implement export metadata**

In the route, compute:

```ts
const generatedAt = Date.now();
const filename = `controlled-trace-${run.id}-${generatedAt}.json`;
```

Return:

```ts
return Response.json({
  ok: true,
  data: {
    artifact: buildControlledTraceArtifact(run),
    export: {
      filename,
      generatedAt,
      contentType: "application/json",
      governanceMode: "fixture",
    },
  },
});
```

- [x] **Step 4: Run route test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
git commit -m "feat: add trace artifact export metadata"
```

---

### Task 2: Runtime Console Governed Trace Copy

**Files:**
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

- [x] **Step 1: Write failing console export test**

Add a test that:

- stubs `navigator.clipboard.writeText`;
- returns `buildCompletedRunWithAssetLandings()` from `/controlled-runs`;
- returns a governed artifact response from `/trace-artifact`;
- clicks `复制脱敏 Trace`;
- asserts fetch called `/api/runtime/executor/controlled-runs/run-assets-1/trace-artifact`;
- asserts clipboard text contains `"artifact"` and `"run-assets-1"`;
- asserts clipboard text does not contain a seeded raw secret such as `sk-console-secret`.

- [x] **Step 2: Run console test to verify RED**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: FAIL because the export button does not exist.

- [x] **Step 3: Implement console copy action**

Add:

```ts
const handleCopyControlledTraceArtifact = async (runId: string) => {
  const actionId = `${runId}:trace-artifact`;
  setControlledRunActionLoading(actionId);
  try {
    const res = await fetch(
      buildAgentCoreApiUrl(
        `/api/runtime/executor/controlled-runs/${encodeURIComponent(runId)}/trace-artifact`,
      ),
      { method: "GET", cache: "no-store" },
    );
    const data = (await res.json().catch(() => null)) as null | {
      ok?: boolean;
      data?: { artifact?: unknown; export?: unknown };
      error?: string;
    };
    if (!res.ok || !data?.ok || !data.data?.artifact) {
      showToast(data?.error || "脱敏 Trace 获取失败", "error");
      return;
    }
    await navigator.clipboard.writeText(
      JSON.stringify({ export: data.data.export, artifact: data.data.artifact }, null, 2),
    );
    showToast("已复制脱敏 Trace", "ok");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "脱敏 Trace 复制失败", "error");
  } finally {
    setControlledRunActionLoading(null);
  }
};
```

Render a compact governed trace control under selected run metadata.

- [x] **Step 4: Run console test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/apps/ClawRuntimeConsoleAppWindow.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
git commit -m "feat: copy governed trace artifacts from console"
```

---

### Task 3: Controlled Run Retention Prune Helper

**Files:**
- Modify: `src/lib/server/controlled-execution-store.ts`
- Modify: `src/__tests__/lib/server/controlled-execution-store.test.ts`

- [x] **Step 1: Write failing prune tests**

Add tests that seed runs through `createControlledExecutionRun` and `updateControlledExecutionRun`.

Assertions:

```ts
const result = await pruneControlledExecutionRuns({
  now: 10_000,
  maxAgeMs: 1_000,
  minTerminalRunsToKeep: 1,
});

expect(result.prunedRunIds).toContain("old-completed");
expect(result.prunedRunIds).not.toContain("old-running");
expect(result.prunedRunIds).not.toContain("old-awaiting-approval");
expect(await getControlledExecutionRun("old-completed")).toBeNull();
expect(await getControlledExecutionRun("old-running")).not.toBeNull();
expect(await getControlledExecutionRun("old-awaiting-approval")).not.toBeNull();
```

- [x] **Step 2: Run store test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: FAIL because `pruneControlledExecutionRuns` does not exist.

- [x] **Step 3: Implement prune helper**

Add exported types and helper:

```ts
export type ControlledRunRetentionPolicy = {
  now?: number;
  maxAgeMs: number;
  minTerminalRunsToKeep: number;
};

export async function pruneControlledExecutionRuns(policy: ControlledRunRetentionPolicy) {
  const referenceTime = Number.isFinite(policy.now) ? policy.now! : now();
  const cutoff = referenceTime - Math.max(0, policy.maxAgeMs);
  const minTerminalRunsToKeep = Math.max(0, Math.floor(policy.minTerminalRunsToKeep));
  let prunedRunIds: string[] = [];
  let keptRunIds: string[] = [];

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const runs = current
      .map(normalizeRun)
      .filter((item): item is ControlledExecutionRunRecord => Boolean(item));
    const terminalRuns = runs
      .filter(isTerminalControlledRun)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const protectedTerminalIds = new Set(
      terminalRuns.slice(0, minTerminalRunsToKeep).map((run) => run.id),
    );
    const kept = runs.filter((run) => {
      if (!isTerminalControlledRun(run)) return true;
      if (protectedTerminalIds.has(run.id)) return true;
      return run.updatedAt >= cutoff;
    });
    const keptIds = new Set(kept.map((run) => run.id));
    prunedRunIds = runs.filter((run) => !keptIds.has(run.id)).map((run) => run.id);
    keptRunIds = kept.map((run) => run.id);
    return kept.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_RUNS);
  });

  return { prunedRunIds, keptRunIds };
}
```

Add local `isTerminalControlledRun`.

- [x] **Step 4: Run store test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/server/controlled-execution-store.ts src/__tests__/lib/server/controlled-execution-store.test.ts
git commit -m "feat: prune terminal controlled runs"
```

---

### Task 4: Coverage, Docs, And Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-governance-console-export-retention.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Run targeted verification**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 3: Update docs and records**

Record:

- console governed trace copy action;
- artifact export metadata;
- retention prune helper safety rules;
- verification results;
- next recommended phase.

- [x] **Step 4: Re-run final verification after docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [x] **Step 5: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-governance-console-export-retention.md
git commit -m "docs: complete trace governance export retention"
```

---

## Plan Self-Review

- Spec coverage: console export, route metadata, retention pruning, tests, docs, and verification all have explicit tasks.
- Placeholder scan: no TBD/TODO/fill-in-later markers.
- Type consistency: route response uses `data.export`, console action serializes `{ export, artifact }`, and retention helper returns `{ prunedRunIds, keptRunIds }`.

## Completion Record

Commits:

- `447705b` — `docs: spec trace governance export retention`
- `6366937` — `feat: add trace artifact export metadata`
- `0bb55cc` — `feat: copy governed trace artifacts from console`
- `d415165` — `feat: prune terminal controlled runs`

Verification before final docs:

- `npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/lib/server/controlled-execution-store.test.ts` — 3 files / 14 tests passed.
- `npm run test:controlled-runtime` — 23 files / 134 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

Final verification after docs:

- `npm run test:controlled-runtime` — 23 files / 134 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

Next phase:

- `Trace Fixture Generation And Replay`.

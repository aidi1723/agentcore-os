# Runtime Console Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled run filtering, approval actions, and resume actions to the existing Runtime Console trace panel.

**Architecture:** Extend the tested controlled run console summary helper with operation flags and filters, then wire those fields into `ClawRuntimeConsoleAppWindow` using existing approve and resume APIs. Keep UI changes local to the existing `受控运行 Trace` panel.

**Tech Stack:** React, Next.js App Router APIs, TypeScript, Vitest, existing controlled execution APIs.

---

## Scope

Spec: [Runtime Console Operations Design](../specs/2026-07-05-runtime-console-operations-design.md)

In scope:

- Summary flags for `canApprove`, `pendingApprovalStepId`, and `canResume`.
- Summary filtering by state and text query.
- Runtime Console state filter and query input.
- Runtime Console approve / reject / resume buttons.

Out of scope:

- Deep asset jumps.
- Bulk operations.
- Automatic polling.
- New backend persistence.

## File Structure

Modify:

- `src/lib/executor/runtime/console-summary.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `CHANGELOG.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-05.md`

---

### Task 1: Add Operation Flags And Filters

- [ ] **Step 1: Write failing summary tests**

Extend `src/__tests__/lib/executor/runtime/console-summary.test.ts` with tests for:

- `pendingApprovalStepId` and `canApprove` on an awaiting approval run,
- `canResume` on a non-terminal run,
- state filtering,
- text query filtering.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: FAIL because operation flags and filter helper do not exist.

- [ ] **Step 3: Implement summary changes**

Modify `src/lib/executor/runtime/console-summary.ts`:

- add `pendingApprovalStepId?: string`,
- add `canApprove: boolean`,
- add `canResume: boolean`,
- export `filterControlledRunConsoleSummaries(summaries, filters)`.

- [ ] **Step 4: Verify summary tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/console-summary.ts src/__tests__/lib/executor/runtime/console-summary.test.ts
git commit -m "feat: derive controlled run console operations"
```

### Task 2: Wire Runtime Console Operations

- [ ] **Step 1: Add UI state and handlers**

Modify `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`:

- add selected state filter,
- add query input,
- add operation loading state,
- add `handleResolveControlledApproval(runId, stepId, approved)`,
- add `handleResumeControlledRun(runId)`.

- [ ] **Step 2: Render filters and action buttons**

Inside `受控运行 Trace`:

- filter run list with `filterControlledRunConsoleSummaries`,
- render state filter buttons,
- render query input,
- render approve / reject buttons when `canApprove`,
- render resume button when `canResume`.

- [ ] **Step 3: Verify controlled runtime, lint, and build**

Run:

```bash
npm run test:controlled-runtime
npm run lint
npm run build
```

Expected: PASS, with only the existing `<img>` warning for lint/build.

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/ClawRuntimeConsoleAppWindow.tsx
git commit -m "feat: operate controlled runs from runtime console"
```

### Task 3: Final Verification And Docs

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

- [ ] **Step 2: Update docs and memory**

Update changelog, development manual, this plan checklist, and daily memory.

- [ ] **Step 3: Commit docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-05-runtime-console-operations.md
git commit -m "docs: track runtime console operations"
```

## Self-Review

- Spec coverage: operation flags, filtering, UI actions, docs, and verification are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: filters and flags are defined in the summary helper and consumed by the console.

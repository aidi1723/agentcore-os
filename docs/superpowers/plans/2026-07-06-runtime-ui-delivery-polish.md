# Runtime UI Delivery Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrow Runtime Console delivery handoff summary so the local delivery path is easier to understand without redesigning the whole UI.

**Architecture:** Keep the state derivation in `src/lib/executor/runtime/console-summary.ts` as a pure helper. Render the helper output in `src/components/apps/ClawRuntimeConsoleAppWindow.tsx` above the existing controlled run filter bar. Preserve all existing runtime operations and asset landing behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Delivery Summary Helper

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- Modify: `src/lib/executor/runtime/console-summary.ts`

- [x] **Step 1: Write the failing helper test**

Add a test that builds completed, awaiting approval, and retryable failed controlled run summaries, then asserts a delivery summary with:

```ts
expect(delivery.totalRuns).toBe(3);
expect(delivery.pendingApprovalRuns).toBe(1);
expect(delivery.retryableFailedRuns).toBe(1);
expect(delivery.successfulAssetLandings).toBeGreaterThan(0);
expect(delivery.governedTraceCandidates).toBe(1);
expect(delivery.statusLabel).toBe("Action required");
```

- [x] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: fail because `buildControlledRunDeliverySummary` does not exist.

- [x] **Step 3: Implement the pure helper**

Add `ControlledRunDeliverySummary` and `buildControlledRunDeliverySummary()` to `console-summary.ts`.

- [x] **Step 4: Run the targeted test and verify it passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: pass.

### Task 2: Runtime Console Delivery Handoff Band

**Files:**
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`

- [x] **Step 1: Write the failing component test**

Add a test that renders the Runtime Console with the existing completed asset run and retryable failed run, then asserts:

```ts
expect(await screen.findByText("Delivery handoff")).toBeInTheDocument();
expect(screen.getByText("Action required")).toBeInTheDocument();
expect(screen.getByText("Retryable failures")).toBeInTheDocument();
expect(screen.getByText("Asset landings")).toBeInTheDocument();
expect(screen.getByText("Governed trace")).toBeInTheDocument();
```

- [x] **Step 2: Run the targeted component test and verify it fails**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: fail because the handoff band is not rendered.

- [x] **Step 3: Render the handoff band**

Import the helper, derive the summary from all recent controlled run summaries, and render a compact band above filters. Use existing Tailwind panel, border, and semantic badge styles.

- [x] **Step 4: Run the targeted component test and verify it passes**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: pass.

### Task 3: Documentation And Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Update records**

Record the Runtime UI Delivery Polish slice, its scope, and the explicit non-goal of broad UI redesign.

- [x] **Step 2: Run controlled verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all exit 0. Existing `<img>` lint/build warning in `src/__tests__/components/ShellUI.test.tsx` may remain.

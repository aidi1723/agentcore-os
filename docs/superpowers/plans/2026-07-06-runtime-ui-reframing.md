# Runtime UI Reframing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the home screen as a controlled playbook cockpit instead of a generic app/chat desk.

**Architecture:** Add a pure runtime cockpit summary helper in `src/lib/home-command-center.ts`, cover it with focused unit tests, then pass the summary into `SolutionCenterPanel` and `CommandCenterSidebar`. Keep all existing app/window/workflow behavior intact.

**Tech Stack:** React, TypeScript, Vitest, existing Tailwind utility styling, existing `DESIGN.md` operational cockpit design contract.

---

## File Structure

- Create `src/__tests__/lib/home-command-center.test.ts`
  - Unit coverage for runtime cockpit summary labels, metrics, and tones.
- Modify `src/lib/home-command-center.ts`
  - Add `RuntimeCockpitSummary` types and `buildRuntimeCockpitSummary()`.
- Modify `src/components/SolutionCenterPanel.tsx`
  - Build the summary from current run/runtime counts and use it in hero copy/actions.
- Modify `src/components/CommandCenterSidebar.tsx`
  - Show runtime cockpit status before generic tools.
- Modify docs and records after implementation:
  - `CHANGELOG.md`
  - `README.md`
  - `docs/NEXT_STEPS.md`
  - `docs/ROADMAP.md`
  - `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - this plan
  - `memory/2026-07-06.md`

---

### Task 1: Add Failing Runtime Cockpit Summary Tests

**Files:**
- Create: `src/__tests__/lib/home-command-center.test.ts`

- [ ] **Step 1: Add tests**

Create `src/__tests__/lib/home-command-center.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRuntimeCockpitSummary } from "@/lib/home-command-center";

describe("buildRuntimeCockpitSummary", () => {
  it("frames the home surface as a controlled playbook cockpit", () => {
    const summary = buildRuntimeCockpitSummary({
      runtimeReady: true,
      runtimeLabel: "Local Runtime",
      scenarioTitle: "Sales Intake Flow",
      workflowTitle: "Qualify and draft outreach",
      selectedRunState: "running",
      pendingApprovalCount: 2,
      runningCount: 1,
      failedCount: 0,
      language: "en-US",
    });

    expect(summary.title).toBe("Controlled Playbook Cockpit");
    expect(summary.subtitle).toBe("Sales Intake Flow · Qualify and draft outreach");
    expect(summary.primaryActionLabel).toBe("Open Runtime Console");
    expect(summary.secondaryActionLabel).toBe("Run controlled playbook");
    expect(summary.metrics).toEqual([
      {
        id: "playbook",
        label: "Playbook run",
        value: "Running",
        detail: "Current controlled execution state",
        tone: "neutral",
      },
      {
        id: "approvals",
        label: "Approvals",
        value: "2",
        detail: "Human review gates",
        tone: "warning",
      },
      {
        id: "recovery",
        label: "Recovery",
        value: "0",
        detail: "Failed or retryable runs",
        tone: "neutral",
      },
      {
        id: "governance",
        label: "Governance gate",
        value: "Ready",
        detail: "Local Runtime · governed trace and replay gates",
        tone: "success",
      },
    ]);
  });

  it("marks governance as warning when runtime is not ready", () => {
    const summary = buildRuntimeCockpitSummary({
      runtimeReady: false,
      runtimeLabel: "Local Runtime",
      scenarioTitle: null,
      workflowTitle: null,
      selectedRunState: null,
      pendingApprovalCount: 0,
      runningCount: 0,
      failedCount: 1,
      language: "en-US",
    });

    expect(summary.subtitle).toBe("Select a controlled playbook to inspect execution state");
    expect(summary.metrics.find((metric) => metric.id === "recovery")).toMatchObject({
      value: "1",
      tone: "danger",
    });
    expect(summary.metrics.find((metric) => metric.id === "governance")).toMatchObject({
      value: "Check",
      tone: "warning",
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/__tests__/lib/home-command-center.test.ts
```

Expected: FAIL because `buildRuntimeCockpitSummary` does not exist.

- [ ] **Step 3: Commit RED tests**

```bash
git add src/__tests__/lib/home-command-center.test.ts
git diff --check --cached
git commit -m "test: specify runtime cockpit summary"
```

---

### Task 2: Implement Runtime Cockpit Summary Helper

**Files:**
- Modify: `src/lib/home-command-center.ts`

- [ ] **Step 1: Add types and helper**

Add:

```ts
export type RuntimeCockpitMetric = {
  id: "playbook" | "approvals" | "recovery" | "governance";
  label: string;
  value: string;
  detail: string;
  tone: CommandCenterTone;
};

export type RuntimeCockpitSummary = {
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  metrics: RuntimeCockpitMetric[];
};

function formatRunState(state: string | null | undefined, lang: "zh" | "en" | "ja") {
  if (lang === "zh") {
    if (state === "running") return "运行中";
    if (state === "completed") return "已完成";
    if (state === "error") return "异常";
    if (state === "awaiting_human") return "待审批";
    return "未启动";
  }
  if (lang === "ja") {
    if (state === "running") return "Running";
    if (state === "completed") return "Completed";
    if (state === "error") return "Failed";
    if (state === "awaiting_human") return "Awaiting review";
    return "Not started";
  }
  if (state === "running") return "Running";
  if (state === "completed") return "Completed";
  if (state === "error") return "Failed";
  if (state === "awaiting_human") return "Awaiting review";
  return "Not started";
}
```

Then add `buildRuntimeCockpitSummary()` with localized labels for zh/en/ja and metrics matching the tests.

- [ ] **Step 2: Verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/home-command-center.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit helper**

```bash
git add src/lib/home-command-center.ts
git diff --check --cached
git commit -m "feat: add runtime cockpit summary model"
```

---

### Task 3: Wire Runtime Cockpit Summary Into Home UI

**Files:**
- Modify: `src/components/SolutionCenterPanel.tsx`
- Modify: `src/components/CommandCenterSidebar.tsx`

- [ ] **Step 1: Import and build summary**

In `SolutionCenterPanel.tsx`, import `buildRuntimeCockpitSummary` and build it after current counts are computed.

- [ ] **Step 2: Reframe hero copy and actions**

Use summary title/subtitle in the top of the central panel. Add a compact metric row under the title. Make `Open Runtime Console` a visible action that opens `runtime_console`; keep `Run workflow` as the secondary controlled playbook action.

- [ ] **Step 3: Reframe sidebar**

Pass `runtimeCockpitSummary` to `CommandCenterSidebar` and render a top `Runtime cockpit` section before the tools grid.

- [ ] **Step 4: Verify UI compiles through targeted tests**

Run:

```bash
npm test -- src/__tests__/lib/home-command-center.test.ts src/__tests__/components/ShellUI.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit UI wiring**

```bash
git add src/components/SolutionCenterPanel.tsx src/components/CommandCenterSidebar.tsx
git diff --check --cached
git commit -m "feat: reframe home as runtime cockpit"
```

---

### Task 4: Documentation, Records, And Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-runtime-ui-reframing.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Mark plan complete**

Update checkboxes and add completion notes with commits and verification.

- [ ] **Step 2: Update docs**

Record:

```text
Runtime UI Reframing first slice: home screen now leads with controlled playbook cockpit state and Runtime Console inspection.
```

Set next recommended phase:

```text
Runtime Console Delivery Readiness Audit
```

- [ ] **Step 3: Run final verification**

Run:

```bash
git diff --check
npm test -- src/__tests__/lib/home-command-center.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
```

Expected: all commands exit 0. Existing `<img>` lint warning may remain if unchanged.

- [ ] **Step 4: Commit docs**

```bash
git add CHANGELOG.md README.md docs/NEXT_STEPS.md docs/ROADMAP.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/superpowers/plans/2026-07-06-runtime-ui-reframing.md
git diff --check --cached
git commit -m "docs: complete runtime ui reframing"
```

---

## Final Verification Checklist

- [ ] `git diff --check`
- [ ] `npm test -- src/__tests__/lib/home-command-center.test.ts`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`
- [ ] `npm run lint`

## Expected Next Phase

Runtime Console Delivery Readiness Audit: decide what remains before this runtime-first branch is presentable as a controlled playbook product rather than a development prototype.

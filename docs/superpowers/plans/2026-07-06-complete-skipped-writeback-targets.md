# Complete Skipped Writeback Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert controlled `workflow_run` and `draft` writeback targets from skipped receipts into real server-backed writes.

**Architecture:** Extend `src/lib/executor/runtime/writeback.ts` with narrow builders and store writers for the existing workflow run and draft stores. Keep all writes deterministic through stable ids and keep approval gates in the existing executor path.

**Tech Stack:** TypeScript, Vitest, existing JSON-backed server stores, controlled runtime executor.

---

## Scope

Spec: [Complete Skipped Writeback Targets Design](../specs/2026-07-06-complete-skipped-writeback-targets-design.md)

In scope:

- Real `workflow_run` writeback via `upsertWorkflowRunInStore`.
- Real `draft` writeback via `upsertDraftInStore`.
- Stable receipt metadata for both targets.
- Unit and controlled runtime regression updates.
- Docs and local memory updates.

Out of scope:

- Runtime Console deep links for workflow runs or drafts.
- Generic writeback registry.
- New UI.
- Historical migration.
- New dependencies.

## File Structure

Modify:

- `src/lib/executor/runtime/writeback.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/__tests__/lib/executor/controlled-runtime.test.ts`
- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-06.md` if local memory is being maintained.

---

### Task 1: Write Workflow Run Target

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/writeback.test.ts`
- Modify: `src/lib/executor/runtime/writeback.ts`

- [ ] **Step 1: Write failing workflow run store test**

In `src/__tests__/lib/executor/runtime/writeback.test.ts`, import:

```ts
import { listWorkflowRunStoreSnapshot } from "@/lib/server/workflow-run-store";
```

Replace the unsupported-target assertion for the `intake` step with a test named:

```ts
it("writes workflow run target to the workflow run store", async () => {
  const step = salesPipelinePlaybook.steps.find((item) => item.id === "intake")!;

  const receipts = await writeControlledStepAssets({
    run: makeRun(),
    step,
    result: previousResults[0],
    previousResults: [],
    approved: true,
  });

  expect(receipts).toEqual([
    expect.objectContaining({
      target: "workflow_run",
      ok: true,
      sourceKey: "controlled-run:run-1:workflow_run",
      workflowRunId: "workflow-1",
    }),
  ]);
  expect(receipts[0].summary).toContain("workflow-1");

  const snapshot = await listWorkflowRunStoreSnapshot();
  expect(snapshot.workflowRuns).toHaveLength(1);
  expect(snapshot.workflowRuns[0]).toMatchObject({
    id: "workflow-1",
    scenarioId: "sales-pipeline",
    scenarioTitle: "Sales Pipeline Controlled Runtime",
    state: "running",
    currentStageId: "qualify",
  });
  expect(snapshot.workflowRuns[0].stageRuns.map((stage) => [stage.id, stage.state])).toEqual([
    ["intake", "completed"],
    ["qualify", "running"],
    ["draft_outreach", "pending"],
    ["human_review", "pending"],
    ["writeback", "pending"],
  ]);
});
```

- [ ] **Step 2: Verify test fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: FAIL because `workflow_run` still returns `Skipped unsupported writeback target workflow_run`.

- [ ] **Step 3: Implement workflow run writer**

In `src/lib/executor/runtime/writeback.ts`, import:

```ts
import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import { upsertWorkflowRunInStore } from "@/lib/server/workflow-run-store";
```

Add helpers:

```ts
function buildWorkflowRunInput(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const workflowRunId = workflowRunIdFor(input.run);
  const scenarioId = scenarioIdFor(input.run);
  const playbook = getControlledPlaybook(input.run.playbookId);
  const currentStepIndex = input.run.plan.steps.findIndex((step) => step.id === input.result.stepId);
  const normalizedIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isFinalWriteback = input.result.stepId === "writeback" && input.approved;
  const nextStep = input.run.plan.steps[normalizedIndex + 1];
  const stageRuns = input.run.plan.steps.map((step, index) => {
    const state =
      isFinalWriteback || index <= normalizedIndex
        ? "completed"
        : index === normalizedIndex + 1
          ? step.mode === "review" || step.mode === "manual"
            ? "awaiting_human"
            : "running"
          : "pending";
    return {
      id: step.id,
      title: step.title,
      mode: step.mode,
      state,
    };
  });
  return {
    id: workflowRunId,
    scenarioId,
    scenarioTitle: playbook?.title ?? input.run.plan.goal ?? input.run.playbookId,
    triggerType: "manual",
    state: isFinalWriteback ? "completed" : nextStep?.mode === "review" || nextStep?.mode === "manual" ? "awaiting_human" : "running",
    currentStageId: isFinalWriteback ? undefined : nextStep?.id ?? input.result.stepId,
    stageRuns,
    createdAt: input.run.createdAt,
    updatedAt: writtenAt,
  };
}
```

Add `writeWorkflowRun`:

```ts
async function writeWorkflowRun(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildWorkflowRunInput(input, writtenAt);
  const result = await upsertWorkflowRunInStore(payload);
  const stored = result.workflowRun;
  if (!stored) {
    return {
      target: "workflow_run",
      ok: false,
      summary: "Failed to write workflow run",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "workflow_run",
    ok: true,
    summary: `Wrote workflow run ${stored.id} as ${stored.state}`,
    writtenAt,
    sourceKey: `controlled-run:${input.run.id}:workflow_run`,
    workflowRunId: stored.id,
  } satisfies ControlledWritebackReceipt;
}
```

Wire it in the target switch before unsupported fallback:

```ts
} else if (target.target === "workflow_run") {
  receipts.push(await writeWorkflowRun(input, writtenAt));
}
```

- [ ] **Step 4: Verify workflow run test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: PASS for workflow run behavior; draft may still be skipped.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/writeback.ts src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "feat: write controlled workflow runs"
```

### Task 2: Write Draft Target

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/writeback.test.ts`
- Modify: `src/lib/executor/runtime/writeback.ts`

- [ ] **Step 1: Write failing draft store test**

In `src/__tests__/lib/executor/runtime/writeback.test.ts`, import:

```ts
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
```

Replace the old unsupported draft test with:

```ts
it("writes draft target to the draft store", async () => {
  const step = salesPipelinePlaybook.steps.find((item) => item.id === "draft_outreach")!;

  const receipts = await writeControlledStepAssets({
    run: makeRun(),
    step,
    result: previousResults[2],
    previousResults: previousResults.slice(0, 2),
    approved: true,
  });

  expect(receipts).toEqual([
    expect.objectContaining({
      target: "draft",
      ok: true,
      assetId: "controlled-draft:workflow-1",
      sourceKey: "controlled-run:run-1:draft",
      workflowRunId: "workflow-1",
    }),
  ]);

  const snapshot = await listDraftStoreSnapshot();
  expect(snapshot.drafts).toHaveLength(1);
  expect(snapshot.drafts[0]).toMatchObject({
    id: "controlled-draft:workflow-1",
    title: "Window project follow-up",
    body: "Draft body",
    source: "publisher",
    workflowRunId: "workflow-1",
    workflowScenarioId: "sales-pipeline",
    workflowStageId: "draft_outreach",
    workflowOriginId: "run-1",
    workflowOriginLabel: "sales-pipeline-v1",
  });
});
```

- [ ] **Step 2: Verify test fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: FAIL because `draft` still returns `Skipped unsupported writeback target draft`.

- [ ] **Step 3: Implement draft writer**

In `src/lib/executor/runtime/writeback.ts`, import:

```ts
import { upsertDraftInStore } from "@/lib/server/draft-store";
```

Add:

```ts
function buildDraftInput(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedLead = isRecord(intake.normalizedLead) ? intake.normalizedLead : {};
  const qualify = outputFor(allResults, "qualify");
  const draft = outputFor(allResults, "draft_outreach");
  const workflowRunId = workflowRunIdFor(input.run);
  const company = stringValue(normalizedLead.company);
  const contact = stringValue(normalizedLead.contact);
  const assumptions = stringList(draft.assumptions);
  const needsHumanCheck = stringList(draft.needsHumanCheck);
  return {
    id: stableId("controlled-draft", workflowRunId),
    title: stringValue(draft.subject) || `Sales outreach draft - ${company || workflowRunId}`,
    body: stringValue(draft.body),
    tags: ["controlled-run", "sales-pipeline", input.run.playbookId],
    source: "publisher",
    workflowRunId,
    workflowScenarioId: scenarioIdFor(input.run),
    workflowStageId: "draft_outreach",
    workflowSource: `Controlled run ${input.run.id}`,
    workflowNextStep: "Review and approve the controlled outreach draft.",
    workflowTriggerType: "manual",
    workflowOriginApp: "publisher",
    workflowOriginId: input.run.id,
    workflowOriginLabel: input.run.playbookId,
    workflowAudience: [company, contact].filter(Boolean).join(" / ") || undefined,
    workflowPrimaryAngle: stringValue(qualify.nextAction) || undefined,
    workflowSourceSummary: stringValue(intake.summary) || undefined,
    workflowBlockLabel: "Controlled Runtime",
    workflowPublishNotes: [...assumptions, ...needsHumanCheck].join("\n") || undefined,
    createdAt: input.run.createdAt,
    updatedAt: writtenAt,
  };
}
```

Add `writeDraft`:

```ts
async function writeDraft(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildDraftInput(input, writtenAt);
  const result = await upsertDraftInStore(payload);
  const stored = result.draft;
  if (!stored) {
    return {
      target: "draft",
      ok: false,
      summary: "Failed to write draft",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "draft",
    ok: true,
    summary: `Wrote draft ${stored.id}`,
    writtenAt,
    assetId: stored.id,
    sourceKey: `controlled-run:${input.run.id}:draft`,
    workflowRunId: stored.workflowRunId,
  } satisfies ControlledWritebackReceipt;
}
```

Wire it:

```ts
} else if (target.target === "draft") {
  receipts.push(await writeDraft(input, writtenAt));
}
```

- [ ] **Step 4: Verify draft test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/writeback.ts src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "feat: write controlled drafts"
```

### Task 3: Idempotency And Controlled Runtime Regression

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/writeback.test.ts`
- Modify: `src/__tests__/lib/executor/controlled-runtime.test.ts`

- [ ] **Step 1: Add idempotency test for new targets**

Add to `writeback.test.ts`:

```ts
it("is idempotent for workflow run and draft targets", async () => {
  const workflowStep = salesPipelinePlaybook.steps.find((item) => item.id === "intake")!;
  const draftStep = salesPipelinePlaybook.steps.find((item) => item.id === "draft_outreach")!;

  await writeControlledStepAssets({
    run: makeRun(),
    step: workflowStep,
    result: previousResults[0],
    previousResults: [],
    approved: true,
  });
  await writeControlledStepAssets({
    run: makeRun(),
    step: workflowStep,
    result: previousResults[0],
    previousResults: [],
    approved: true,
  });
  await writeControlledStepAssets({
    run: makeRun(),
    step: draftStep,
    result: previousResults[2],
    previousResults: previousResults.slice(0, 2),
    approved: true,
  });
  await writeControlledStepAssets({
    run: makeRun(),
    step: draftStep,
    result: previousResults[2],
    previousResults: previousResults.slice(0, 2),
    approved: true,
  });

  expect((await listWorkflowRunStoreSnapshot()).workflowRuns).toHaveLength(1);
  expect((await listDraftStoreSnapshot()).drafts).toHaveLength(1);
});
```

- [ ] **Step 2: Update controlled runtime skipped assertions**

In `src/__tests__/lib/executor/controlled-runtime.test.ts`, update assertions that expect:

```ts
summary: "Skipped unsupported writeback target workflow_run"
```

to expect:

```ts
target: "workflow_run",
ok: true,
workflowRunId: "controlled-runtime-test",
sourceKey: "controlled-run:controlled-runtime-test:workflow_run",
```

Also assert that the `draft_outreach` step has a successful `draft` receipt with:

```ts
target: "draft",
ok: true,
assetId: "controlled-draft:controlled-runtime-test",
sourceKey: "controlled-run:controlled-runtime-test:draft",
workflowRunId: "controlled-runtime-test",
```

- [ ] **Step 3: Verify targeted tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/lib/executor/runtime/writeback.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts
git commit -m "test: cover workflow and draft writeback"
```

### Task 4: Documentation And Final Verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-complete-skipped-writeback-targets.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update docs**

Document:

- `workflow_run` and `draft` are now real writeback targets.
- Idempotency is stable by `workflowRunId` / `controlled-draft:{workflowRunId}`.
- Runtime Console deep links for workflow/draft remain a future slice.
- Current `test:controlled-runtime` count after verification.

- [ ] **Step 2: Run final gates**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- controlled runtime passes,
- core workflows pass,
- lint/build exit 0 with only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`,
- `git diff --check` exits 0.

- [ ] **Step 3: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-complete-skipped-writeback-targets.md
git commit -m "docs: complete skipped writeback targets"
```

## Self-Review

- Spec coverage: workflow run writeback, draft writeback, idempotency, approval boundaries, tests, docs, and final verification are covered.
- Placeholder scan: no placeholders are intentionally left.
- Type consistency: record ids, receipt fields, and store function names match the current codebase.

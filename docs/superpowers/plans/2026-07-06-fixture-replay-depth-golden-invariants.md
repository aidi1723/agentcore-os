# Fixture Replay Depth And Golden Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen pure governed trace fixture replay with golden metadata invariants for plan, version, approval, attempt, and writeback identity fields.

**Architecture:** Extend `ControlledTraceReplayDiagnostics` in place and keep `replayControlledTraceFixture()` as the single pure replay boundary. Tests mutate cloned fixture metadata to prove each new invariant fails deterministically while committed sales/support fixtures stay green.

**Tech Stack:** TypeScript, Vitest, existing controlled playbook catalog, existing governed trace fixtures and catalog report helpers.

---

## File Structure

- Modify `src/__tests__/lib/executor/runtime/trace-replay.test.ts`: add TDD coverage for new diagnostics and failure modes.
- Modify `src/lib/executor/runtime/trace-replay.ts`: add structured diagnostics fields and pure metadata invariant checks.
- Modify `docs/NEXT_STEPS.md`: record Phase 10k completion and next recommended phase.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: align framework status with Phase 10k.
- Modify `CHANGELOG.md`: record the replay depth change.
- Modify `memory/2026-07-06.md`: append the local development record.

## Task 1: Write Failing Replay Invariant Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

- [ ] **Step 1: Add all-green diagnostics expectations**

Update the first committed sales fixture test so `report.diagnostics` includes the new fields:

```ts
expect(report.diagnostics).toMatchObject({
  expectedPlaybookVersion: "1.0.0",
  fixturePlaybookVersion: "1.0.0",
  expectedScenarioId: "sales-pipeline",
  fixtureScenarioId: "sales-pipeline",
  expectedPlanId: "playbook:sales-pipeline-v1:1.0.0",
  fixturePlanId: "playbook:sales-pipeline-v1:1.0.0",
  expectedPlanTotalSteps: 5,
  fixturePlanTotalSteps: 5,
  expectedPlanRequiresApproval: true,
  fixturePlanRequiresApproval: true,
  planStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
  missingCompletedStepAttempts: [],
  nonApprovedApprovalStepIds: [],
  writebackTargetsMissingStableMetadata: [],
});
```

- [ ] **Step 2: Add version drift failure test**

```ts
it("rejects fixtures whose playbook version drifts from the current playbook", () => {
  const fixture = cloneFixture();
  fixture.playbookVersion = "0.9.0";

  const report = replayControlledTraceFixture(fixture);

  expect(report.errors).toContain(
    "Fixture playbook version does not match current playbook sales-pipeline-v1",
  );
  expect(report.diagnostics.expectedPlaybookVersion).toBe("1.0.0");
  expect(report.diagnostics.fixturePlaybookVersion).toBe("0.9.0");
});
```

- [ ] **Step 3: Add plan metadata drift failure test**

```ts
it("rejects fixtures whose plan metadata drifts from the current playbook", () => {
  const fixture = cloneFixture();
  if (fixture.plan) {
    fixture.plan.id = "playbook:sales-pipeline-v1:0.9.0";
    fixture.plan.totalSteps = 4;
    fixture.plan.requiresApproval = false;
  }

  const report = replayControlledTraceFixture(fixture);

  expect(report.errors).toContain(
    "Fixture plan id does not match current playbook sales-pipeline-v1",
  );
  expect(report.errors).toContain(
    "Fixture plan totalSteps does not match current playbook sales-pipeline-v1",
  );
  expect(report.errors).toContain(
    "Fixture plan requiresApproval does not match current playbook sales-pipeline-v1",
  );
  expect(report.diagnostics).toMatchObject({
    expectedPlanId: "playbook:sales-pipeline-v1:1.0.0",
    fixturePlanId: "playbook:sales-pipeline-v1:0.9.0",
    expectedPlanTotalSteps: 5,
    fixturePlanTotalSteps: 4,
    expectedPlanRequiresApproval: true,
    fixturePlanRequiresApproval: false,
  });
});
```

- [ ] **Step 4: Add completed attempts failure test**

```ts
it("rejects completed fixture steps without recorded attempts", () => {
  const fixture = cloneFixture();
  const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
  if (writebackStep) writebackStep.attempts = 0;

  const report = replayControlledTraceFixture(fixture);

  expect(report.errors).toContain("Step writeback completed with no recorded attempts");
  expect(report.diagnostics.missingCompletedStepAttempts).toContain("writeback");
});
```

- [ ] **Step 5: Add non-approved terminal approval failure test**

```ts
it("rejects completed approval-gated steps without approved terminal state", () => {
  const fixture = cloneFixture();
  const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
  if (writebackStep) writebackStep.approvalState = "rejected";

  const report = replayControlledTraceFixture(fixture);

  expect(report.errors).toContain(
    "Step writeback requires approved terminal state but fixture approval state is rejected",
  );
  expect(report.diagnostics.nonApprovedApprovalStepIds).toContain("writeback");
});
```

- [ ] **Step 6: Add stable writeback metadata failure test**

```ts
it("rejects successful writeback targets missing stable metadata", () => {
  const fixture = cloneFixture();
  const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
  const salesTarget = writebackStep?.writebackTargets.find(
    (target) => target.target === "sales_asset",
  );
  if (salesTarget) delete salesTarget.sourceKey;

  const report = replayControlledTraceFixture(fixture);

  expect(report.errors).toContain(
    "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
  );
  expect(report.diagnostics.writebackTargetsMissingStableMetadata).toContainEqual({
    stepId: "writeback",
    target: "sales_asset",
    missingFields: ["sourceKey"],
  });
});
```

- [ ] **Step 7: Run tests to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: FAIL because new diagnostics fields and invariant checks do not exist yet.

- [ ] **Step 8: Commit failing tests only if the team wants red commits**

Default for this repo phase: do not commit red tests separately unless explicitly requested. Proceed to implementation after observing the expected failure.

## Task 2: Implement Replay Golden Invariants

**Files:**
- Modify: `src/lib/executor/runtime/trace-replay.ts`

- [ ] **Step 1: Extend diagnostic types**

Add:

```ts
export type ControlledTraceReplayMissingStableMetadata = {
  stepId: string;
  target: ControlledPlaybookWriteTarget;
  missingFields: Array<"assetId" | "sourceKey" | "workflowRunId">;
};
```

Extend `ControlledTraceReplayDiagnostics`:

```ts
expectedPlaybookVersion?: string;
fixturePlaybookVersion: string;
expectedScenarioId?: string;
fixtureScenarioId?: string;
expectedPlanId?: string;
fixturePlanId?: string;
expectedPlanTotalSteps?: number;
fixturePlanTotalSteps?: number;
expectedPlanRequiresApproval?: boolean;
fixturePlanRequiresApproval?: boolean;
planStepOrder: string[];
missingCompletedStepAttempts: string[];
nonApprovedApprovalStepIds: string[];
writebackTargetsMissingStableMetadata: ControlledTraceReplayMissingStableMetadata[];
```

- [ ] **Step 2: Add pure helper functions**

Add helper functions near existing `hasWritebackTarget()`:

```ts
function buildExpectedPlanId(playbookId: string, playbookVersion: string) {
  return `playbook:${playbookId}:${playbookVersion}`;
}

function playbookRequiresApproval(playbook: NonNullable<ReturnType<typeof getControlledPlaybook>>) {
  return playbook.steps.some((step) => step.requiresApproval);
}

function getMissingStableMetadataFields(
  writebackTarget: ControlledTraceFixture["steps"][number]["writebackTargets"][number],
) {
  const missingFields: Array<"assetId" | "sourceKey" | "workflowRunId"> = [];
  if (!writebackTarget.assetId) missingFields.push("assetId");
  if (!writebackTarget.sourceKey) missingFields.push("sourceKey");
  if (!writebackTarget.workflowRunId) missingFields.push("workflowRunId");
  return missingFields;
}
```

- [ ] **Step 3: Populate base diagnostics before playbook lookup**

Include fixture-side diagnostics even when the playbook is missing:

```ts
const baseDiagnostics = {
  fixtureId: fixture.fixtureId,
  playbookId: fixture.playbookId,
  fixturePlaybookVersion: fixture.playbookVersion,
  fixtureScenarioId: fixture.scenarioId,
  fixturePlanId: fixture.plan?.id,
  fixturePlanTotalSteps: fixture.plan?.totalSteps,
  fixturePlanRequiresApproval: fixture.plan?.requiresApproval,
  planStepOrder: fixture.plan?.stepOrder ?? [],
  fixtureStepOrder: checkedStepIds,
  missingApprovalStepIds: [],
  missingWritebackTargets: [],
  missingCompletedStepAttempts: [],
  nonApprovedApprovalStepIds: [],
  writebackTargetsMissingStableMetadata: [],
};
```

- [ ] **Step 4: Add playbook-level invariant checks**

After resolving the playbook and deriving `playbookStepIds`, compute:

```ts
const expectedPlanId = buildExpectedPlanId(playbook.id, playbook.version);
const expectedPlanTotalSteps = playbook.steps.length;
const expectedPlanRequiresApproval = playbookRequiresApproval(playbook);
```

Push the three new plan/version/scenario errors when values are present and drift:

```ts
if (fixture.playbookVersion !== playbook.version) {
  errors.push(`Fixture playbook version does not match current playbook ${fixture.playbookId}`);
}
if (fixture.scenarioId && fixture.scenarioId !== playbook.scenarioId) {
  errors.push(`Fixture scenarioId does not match current playbook ${fixture.playbookId}`);
}
if (fixture.plan?.id && fixture.plan.id !== expectedPlanId) {
  errors.push(`Fixture plan id does not match current playbook ${fixture.playbookId}`);
}
if (
  typeof fixture.plan?.totalSteps === "number" &&
  fixture.plan.totalSteps !== expectedPlanTotalSteps
) {
  errors.push(`Fixture plan totalSteps does not match current playbook ${fixture.playbookId}`);
}
if (
  typeof fixture.plan?.requiresApproval === "boolean" &&
  fixture.plan.requiresApproval !== expectedPlanRequiresApproval
) {
  errors.push(`Fixture plan requiresApproval does not match current playbook ${fixture.playbookId}`);
}
```

- [ ] **Step 5: Add step invariant checks**

Inside the playbook step loop, after existing approval/writeback checks:

```ts
if (fixtureStep?.state === "completed" && fixtureStep.attempts < 1) {
  missingCompletedStepAttempts.push(playbookStep.id);
  errors.push(`Step ${playbookStep.id} completed with no recorded attempts`);
}

if (
  fixtureStep?.state === "completed" &&
  playbookStep.requiresApproval &&
  fixtureStep.approvalState &&
  fixtureStep.approvalState !== "approved"
) {
  nonApprovedApprovalStepIds.push(playbookStep.id);
  errors.push(
    `Step ${playbookStep.id} requires approved terminal state but fixture approval state is ${fixtureStep.approvalState}`,
  );
}

for (const writebackTarget of fixtureStep?.writebackTargets ?? []) {
  if (!writebackTarget.ok) continue;
  const missingFields = getMissingStableMetadataFields(writebackTarget);
  if (missingFields.length === 0) continue;
  writebackTargetsMissingStableMetadata.push({
    stepId: playbookStep.id,
    target: writebackTarget.target as ControlledPlaybookWriteTarget,
    missingFields,
  });
  for (const field of missingFields) {
    errors.push(
      `Step ${playbookStep.id} writeback target ${writebackTarget.target} is missing stable metadata ${field}`,
    );
  }
}
```

- [ ] **Step 6: Return extended diagnostics**

Return:

```ts
diagnostics: {
  ...baseDiagnostics,
  expectedPlaybookVersion: playbook.version,
  expectedScenarioId: playbook.scenarioId,
  expectedPlanId,
  expectedPlanTotalSteps,
  expectedPlanRequiresApproval,
  expectedStepOrder: playbookStepIds,
  missingApprovalStepIds,
  missingWritebackTargets,
  missingCompletedStepAttempts,
  nonApprovedApprovalStepIds,
  writebackTargetsMissingStableMetadata,
},
```

- [ ] **Step 7: Run targeted tests to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run fixture catalog tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit implementation**

```bash
git add src/lib/executor/runtime/trace-replay.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts
git commit -m "test: add fixture replay golden invariants"
```

## Task 3: Update Docs And Records

**Files:**
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update `docs/NEXT_STEPS.md` baseline**

Add Phase 10k to the completed baseline and replace the current recommended next section with a completed Phase 10k section. New completed section should state:

```md
## Completed. Fixture Replay Depth And Golden Invariants

Delivered:

- Pure fixture replay now checks playbook version, scenario id, plan id, plan step count, and plan approval flag against the current registered playbook.
- Replay diagnostics now include expected and fixture plan/version metadata.
- Completed fixture steps must record at least one attempt.
- Completed approval-gated steps must carry approved terminal state.
- Successful writeback receipts must carry stable `assetId`, `sourceKey`, and `workflowRunId` metadata.
- Replay remains pure: no LLM calls, no tool execution, no API route calls, no runtime store mutation, and no asset writes.
```

Then set the next recommended phase to:

```md
## Recommended Next. Fixture Replay Contract Documentation

Suggested scope:

- Document the replay invariant matrix for maintainers.
- Add a compact table covering playbook, plan, step, approval, and writeback metadata.
- Link the matrix from the fixture refresh guide so reviewers know why a candidate fixture fails.
```

- [ ] **Step 2: Update controlled runtime manual**

Replace the existing Phase 10k future text with completed status:

```md
- Phase 10k fixture replay depth and golden invariants：pure replay 已进一步校验 playbook version、scenario、plan id、step count、approval flag、completed attempts、approval terminal state，以及成功 writeback receipt 的 `assetId` / `sourceKey` / `workflowRunId` 稳定 metadata。该阶段仍然不重放工具、不调用 API、不读写 store、不写资产。
```

- [ ] **Step 3: Update changelog**

Add an Unreleased bullet:

```md
### Fixture Replay Golden Invariants

- Extended pure governed trace fixture replay with deeper plan/version/approval/writeback identity invariant checks and diagnostics while preserving no-side-effect guarantees.
```

- [ ] **Step 4: Update memory**

Append a dated Phase 10k note with commits, changed behavior, verification, and next recommended phase.

- [ ] **Step 5: Run docs search**

Run:

```bash
rg "Fixture Replay Depth|golden invariants|Phase 10k|Fixture Replay Contract Documentation" docs CHANGELOG.md memory/2026-07-06.md
```

Expected: finds the new completed phase, manual status, changelog entry, and next recommendation.

- [ ] **Step 6: Commit docs**

```bash
git add docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md CHANGELOG.md memory/2026-07-06.md
git commit -m "docs: complete fixture replay golden invariants"
```

## Task 4: Final Verification

**Files:**
- No edits unless verification exposes a defect.

- [ ] **Step 1: Run fixture summary**

```bash
npm run trace:fixtures --silent
```

Expected: exit 0, `ok: true`, `total: 2`, `failed: 0`.

- [ ] **Step 2: Run controlled runtime suite**

```bash
npm run test:controlled-runtime
```

Expected: all tests pass.

- [ ] **Step 3: Run core workflow suite**

```bash
npm run test:core-workflows
```

Expected: all tests pass.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: exit 0. The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may still appear.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: exit 0. The same existing `<img>` warning may still appear.

- [ ] **Step 6: Run diff whitespace check**

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 7: Inspect final status**

```bash
git status --short
```

Expected: only known unrelated untracked files remain.

## Rollback Checkpoint

- Starting checkpoint before implementation: `e770f59 docs: spec fixture replay golden invariants`.
- Roll back this phase by reverting commits created after that checkpoint.
- No migrations, external writes, runtime stores, generated assets, browser sessions, or publish actions are part of this phase.

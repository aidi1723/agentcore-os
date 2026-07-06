# Trace Fixture Generation And Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert governed trace artifacts into stable, validation-ready regression fixtures without replaying real tools.

**Architecture:** Add a pure fixture builder on top of `ControlledTraceArtifact`. It extracts deterministic metadata, checks redaction boundaries, compares step order against the controlled playbook catalog when possible, and returns a fixture object safe for committed tests.

**Tech Stack:** TypeScript, Vitest, existing trace governance artifact types, controlled playbook catalog.

---

## File Structure

- Create `src/lib/executor/runtime/trace-fixtures.ts`: fixture types, builder, validator.
- Create `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`: TDD coverage for fixture generation and validation.
- Create `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`: safe sample fixture.
- Modify `package.json`: include fixture tests in `test:controlled-runtime`.
- Modify docs and memory after verification.

---

### Task 1: Trace Fixture Builder

**Files:**
- Create: `src/lib/executor/runtime/trace-fixtures.ts`
- Create: `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`

- [x] **Step 1: Write failing fixture builder tests**

Create a governed artifact fixture with all `sales-pipeline-v1` step ids:

```ts
const artifact = {
  id: "run-fixture-1",
  requestId: "req-fixture-1",
  sessionId: "session-1",
  workflowRunId: "workflow-fixture-1",
  scenarioId: "sales-pipeline",
  playbookId: "sales-pipeline-v1",
  playbookVersion: "1.0.0",
  planId: "playbook:sales-pipeline-v1:1.0.0",
  state: "completed",
  currentStepId: "writeback",
  createdAt: 100,
  updatedAt: 200,
  finishedAt: 220,
  governance: {
    mode: "fixture",
    redactedAt: 210,
    policy: {
      mode: "fixture",
      includePlan: true,
      includeStepInput: false,
      includeStepOutput: false,
      includeToolOutputs: false,
      maxStringLength: 240,
    },
  },
  auditEvents: [{ id: "audit-1", type: "console_retry_requested", stepId: "qualify", createdAt: 180, actor: "local_user" }],
  plan: {
    id: "playbook:sales-pipeline-v1:1.0.0",
    goal: { redacted: true, reason: "trace_governance", summary: "string(length=10)" },
    totalSteps: 5,
    requiresApproval: true,
    steps: [
      { id: "intake", title: "Intake", dependsOn: [], mode: "assist", writesTo: [], toolCallCount: 1, hasInputSchema: true, hasOutputSchema: true },
      { id: "qualify", title: "Qualify", dependsOn: ["intake"], mode: "assist", writesTo: [{ target: "sales_asset", when: "on_success" }], toolCallCount: 1, hasInputSchema: true, hasOutputSchema: true },
      { id: "draft_outreach", title: "Draft", dependsOn: ["qualify"], mode: "assist", writesTo: [{ target: "draft", when: "on_success" }], toolCallCount: 1, hasInputSchema: true, hasOutputSchema: true },
      { id: "human_review", title: "Review", dependsOn: ["draft_outreach"], mode: "review", writesTo: [{ target: "workflow_run", when: "after_approval" }], toolCallCount: 1, hasInputSchema: true, hasOutputSchema: true },
      { id: "writeback", title: "Writeback", dependsOn: ["human_review"], mode: "manual", writesTo: [{ target: "sales_asset", when: "after_approval" }], toolCallCount: 1, hasInputSchema: true, hasOutputSchema: true },
    ],
  },
  steps: [
    // one item per sales step; input/output/tool output redacted
  ],
};
```

Assertions:

```ts
const fixture = buildControlledTraceFixture(artifact, { generatedAt: 300 });
expect(fixture.schemaVersion).toBe("controlled-trace-fixture/v1");
expect(fixture.sourceRunId).toBe("run-fixture-1");
expect(fixture.assertions.stepOrder).toEqual(["intake", "qualify", "draft_outreach", "human_review", "writeback"]);
expect(fixture.assertions.knownPlaybookMatched).toBe(true);
expect(fixture.steps[3].approvalState).toBe("approved");
expect(fixture.steps[4].writebackTargets[0]).toMatchObject({
  target: "sales_asset",
  ok: true,
  assetId: "sales-asset-1",
});
expect(validateControlledTraceFixture(fixture)).toEqual({ ok: true, errors: [] });
expect(JSON.stringify(fixture)).not.toContain("Nora");
expect(JSON.stringify(fixture)).not.toContain("sk-fixture-secret");
```

- [x] **Step 2: Run fixture test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

Expected: FAIL because `trace-fixtures.ts` does not exist.

- [x] **Step 3: Implement fixture builder and validator**

Implement exported types and:

- `buildControlledTraceFixture(artifact, options?)`
- `validateControlledTraceFixture(fixture)`

Rules:

- Require governed redaction objects for step input and output.
- Require redacted tool output when tool calls exist.
- Preserve only metadata and boolean redaction flags.
- Compare known playbook step ids from `getControlledPlaybook(artifact.playbookId)`.

- [x] **Step 4: Run fixture test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/trace-fixtures.ts src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
git commit -m "feat: build governed trace fixtures"
```

---

### Task 2: Sample Fixture And Controlled Runtime Coverage

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`
- Modify: `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write failing sample fixture test**

Add a test that imports the JSON fixture and validates it:

```ts
import sampleFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";

expect(validateControlledTraceFixture(sampleFixture)).toEqual({ ok: true, errors: [] });
expect(JSON.stringify(sampleFixture)).not.toContain("Nora");
expect(JSON.stringify(sampleFixture)).not.toContain("sk-fixture-secret");
```

- [x] **Step 2: Run fixture test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

Expected: FAIL because the JSON fixture does not exist.

- [x] **Step 3: Add sample fixture and coverage script**

Create `sales-pipeline-governed.fixture.json` using the fixture shape produced by Task 1.

Add:

```text
src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

to `test:controlled-runtime`.

- [x] **Step 4: Run fixture test and controlled runtime**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
npm run test:controlled-runtime
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add package.json src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
git commit -m "test: include governed trace fixtures"
```

---

### Task 3: Docs And Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-generation-replay.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning.

- [ ] **Step 3: Update docs and records**

Record:

- fixture builder exists;
- fixture validation catches missing redaction;
- sample fixture is committed;
- this phase does not replay tools yet;
- next recommended phase.

- [ ] **Step 4: Re-run final verification after docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [ ] **Step 5: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-generation-replay.md
git commit -m "docs: complete trace fixture generation"
```

---

## Plan Self-Review

- Spec coverage: builder, validator, sample fixture, controlled-runtime coverage, docs, and verification are all covered.
- Placeholder scan: no TBD/TODO/fill-in-later markers.
- Type consistency: `ControlledTraceFixture`, `buildControlledTraceFixture`, and `validateControlledTraceFixture` are used consistently.

# Trace Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed controlled-run trace artifact path that redacts sensitive free-form trace payloads while preserving audit and fixture metadata.

**Architecture:** Keep the existing durable controlled run store unchanged for Runtime Console operations. Add `trace-governance.ts` as a pure transformation layer from `ControlledExecutionRunRecord` to a sanitized artifact, then expose it through a separate local-only API route. Tests drive the redaction boundary and prove the source run is not mutated.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, existing controlled runtime store and local API security helpers.

---

## File Structure

- Create `src/lib/executor/runtime/trace-governance.ts`: pure redaction / artifact builder.
- Create `src/__tests__/lib/executor/runtime/trace-governance.test.ts`: unit coverage for redaction, safe metadata, tool summaries, non-mutation.
- Create `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`: local-only governed artifact route.
- Create `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`: route coverage.
- Modify `package.json`: include the new tests in `test:controlled-runtime`.
- Modify docs and memory after verification.

---

### Task 1: Governed Trace Artifact Helper

**Files:**
- Create: `src/lib/executor/runtime/trace-governance.ts`
- Create: `src/__tests__/lib/executor/runtime/trace-governance.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/__tests__/lib/executor/runtime/trace-governance.test.ts` with tests that import `buildControlledTraceArtifact` from `@/lib/executor/runtime/trace-governance`.

The fixture run should include:

- `input: { customer: "Nora", message: "api_key=sk-test-secret customer complaint" }`
- `output: { draft: "Call Nora at nora@example.com", token: "Bearer abcdefghij" }`
- `error: "password=hunter2"`
- approval feedback with customer text.
- tool call result output containing raw draft text and a token.
- writeback receipt metadata with asset ids.

Assertions:

```ts
const artifact = buildControlledTraceArtifact(run);
const serialized = JSON.stringify(artifact);

expect(serialized).not.toContain("Nora");
expect(serialized).not.toContain("sk-test-secret");
expect(serialized).not.toContain("abcdefghij");
expect(serialized).not.toContain("hunter2");
expect(artifact.id).toBe("run-governed-1");
expect(artifact.playbookId).toBe("sales-pipeline-v1");
expect(artifact.steps[0].input).toMatchObject({ redacted: true });
expect(artifact.steps[0].output).toMatchObject({ redacted: true });
expect(artifact.steps[0].toolCallResults[0]).toMatchObject({
  toolName: "llm_generate",
  success: true,
  durationMs: 1200,
});
expect(artifact.steps[0].writebackReceipts[0]).toMatchObject({
  target: "sales_asset",
  ok: true,
  assetId: "controlled-sales-asset:workflow-1",
});
expect(run.steps[0].input).toEqual({
  customer: "Nora",
  message: "api_key=sk-test-secret customer complaint",
});
```

- [ ] **Step 2: Run helper test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-governance.test.ts
```

Expected: FAIL because `trace-governance.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Implement:

- `ControlledTraceRedaction`
- `ControlledTraceGovernancePolicy`
- `ControlledTraceArtifact`
- `redactTraceValue(value, policy?)`
- `buildControlledTraceArtifact(run, policy?)`

Default policy:

```ts
{
  mode: "fixture",
  includePlan: true,
  includeStepInput: false,
  includeStepOutput: false,
  includeToolOutputs: false,
  maxStringLength: 240,
}
```

Rules:

- Preserve typed ids, states, timestamps, schema status, writeback target metadata.
- Redact step input/output by default.
- Redact tool output/error by default.
- Redact approval feedback, run error, step error, and audit event message through `redactSensitiveText` and clipping.
- Return new objects only.

- [ ] **Step 4: Run helper test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-governance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/trace-governance.ts src/__tests__/lib/executor/runtime/trace-governance.test.ts
git commit -m "feat: add governed trace artifact"
```

---

### Task 2: Trace Artifact API Route

**Files:**
- Create: `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`
- Create: `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`

- [ ] **Step 1: Write the failing route tests**

Create a route test modeled after `src/__tests__/app/api/controlled-run-route.test.ts`.

Assertions:

- missing run returns 404 with `"Controlled run not found"`.
- seeded run returns `data.artifact`.
- artifact does not contain raw customer text or secrets from step input/output.
- artifact keeps `id`, `playbookId`, `steps[0].stepId`, and writeback `assetId`.

- [ ] **Step 2: Run route test to verify RED**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route**

Create a GET handler that:

- uses `rejectUnauthorizedLocalApiRequest(req)`;
- loads the run with `getControlledExecutionRun(runId)`;
- returns 404 if missing;
- returns `buildControlledTraceArtifact(run)`.

- [ ] **Step 4: Run route test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
git commit -m "feat: expose governed trace artifact"
```

---

### Task 3: Controlled Runtime Coverage And Docs

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-governance.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Add tests to `test:controlled-runtime`**

Add:

```text
src/__tests__/lib/executor/runtime/trace-governance.test.ts
src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
```

to the explicit `test:controlled-runtime` script.

- [ ] **Step 2: Run targeted and full verification**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-governance.test.ts src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may still show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [ ] **Step 3: Update docs and records**

Update docs to record:

- governed artifact helper exists;
- local artifact route exists;
- raw controlled run store remains unchanged;
- next Trace Governance work should add Runtime Console export action and retention policy.

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
git add package.json CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-governance.md
git commit -m "docs: complete trace governance artifact slice"
```

---

## Plan Self-Review

- Spec coverage: governed artifact, redaction policy, route boundary, tests, and docs all have tasks.
- Placeholder scan: the plan contains no unresolved markers or vague implementation placeholders.
- Type consistency: `ControlledTraceArtifact`, `buildControlledTraceArtifact`, `redactTraceValue`, and `trace-artifact` are used consistently.

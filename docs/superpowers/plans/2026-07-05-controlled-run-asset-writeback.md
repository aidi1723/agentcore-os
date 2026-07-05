# Controlled Run Asset Writeback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make approved `sales-pipeline-v1` controlled runs write real sales and knowledge assets, with durable writeback receipts in the controlled run trace.

**Architecture:** Replace synthetic writeback receipts with a server-safe writeback helper that maps controlled run outputs into existing server asset stores. Keep this slice narrow: implement only `sales_asset` and `knowledge_asset`; return explicit skipped receipts for unsupported targets.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing controlled runtime store, `src/lib/server/sales-asset-store.ts`, `src/lib/server/knowledge-asset-store.ts`.

---

## Scope

Spec: [Controlled Run Asset Writeback Design](../specs/2026-07-05-controlled-run-asset-writeback-design.md)

In scope:

- Add a real controlled writeback function.
- Write approved sales outputs into server-backed sales assets.
- Write approved sales outputs into server-backed knowledge assets.
- Make writeback idempotent by workflow/run identity.
- Store concrete writeback receipts in controlled step records.
- Cover resume-driven final writeback.

Out of scope:

- UI redesign.
- New app windows.
- Generic writeback framework for every playbook.
- Full draft/workflow-run writeback.
- External publishing.

## File Structure

Modify:

- `src/lib/executor/runtime/writeback.ts`
  - Replace synthetic receipt builder with real server writeback helpers.
- `src/lib/executor/step-executor.ts`
  - Pass controlled run context and prior step results into writeback.
- `src/__tests__/lib/executor/runtime/resume.test.ts`
  - Assert final resume writes real assets and durable receipts.

Create:

- `src/__tests__/lib/executor/runtime/writeback.test.ts`
  - Unit coverage for approved, skipped, idempotent, and unsupported writeback targets.

Do not modify:

- `src/components/*`
- `src/apps/registry.ts`
- `src/app/page.tsx`
- public release docs

---

### Task 1: Add Failing Writeback Unit Tests

**Files:**

- Create: `src/__tests__/lib/executor/runtime/writeback.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/executor/runtime/writeback.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import type { StepResult } from "@/lib/executor/contracts";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import { writeControlledStepAssets } from "@/lib/executor/runtime/writeback";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-writeback-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeRun(): ControlledExecutionRunRecord {
  return {
    id: "run-1",
    requestId: "run-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "running",
    createdAt: 1,
    updatedAt: 1,
    plan: {
      id: "plan-1",
      goal: "sales pipeline",
      totalSteps: 5,
      requiresApproval: true,
      steps: [],
    },
    steps: [],
  };
}

const previousResults: StepResult[] = [
  {
    stepId: "intake",
    status: "completed",
    output: {
      summary: "Customer asks for uPVC windows",
      missingFields: [],
      normalizedLead: {
        company: "ACME",
        contact: "Ada",
        inquiryChannel: "email",
        preferredLanguage: "en",
        productLine: "uPVC windows",
        need: "windows for apartment project",
      },
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "qualify",
    status: "completed",
    output: {
      priority: "high",
      reasons: ["project fit"],
      risks: ["confirm delivery date"],
      nextAction: "send approved follow-up",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "draft_outreach",
    status: "completed",
    output: {
      subject: "Window project follow-up",
      body: "Draft body",
      assumptions: [],
      needsHumanCheck: [],
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "human_review",
    status: "completed",
    output: {
      approved: true,
      approvedBody: "Approved body",
      reviewNotes: "Confirmed by sales",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
];

describe("writeControlledStepAssets", () => {
  it("writes approved final output to sales and knowledge assets", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;
    const result: StepResult = {
      stepId: "writeback",
      status: "completed",
      output: { salesAssetUpdated: true, knowledgeAssetCandidate: "Approved body" },
      toolCallResults: [],
      tokensUsed: 0,
      durationMs: 1,
    };

    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result,
      previousResults,
      approved: true,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
    ]);
    expect(receipts.every((receipt) => receipt.ok)).toBe(true);

    const salesSnapshot = await listSalesAssetStoreSnapshot();
    expect(salesSnapshot.salesAssets).toHaveLength(1);
    expect(salesSnapshot.salesAssets[0]).toMatchObject({
      workflowRunId: "workflow-1",
      company: "ACME",
      contactName: "Ada",
      latestDraftBody: "Approved body",
      status: "completed",
    });

    const knowledgeSnapshot = await listKnowledgeAssetStoreSnapshot();
    expect(knowledgeSnapshot.knowledgeAssets).toHaveLength(1);
    expect(knowledgeSnapshot.knowledgeAssets[0]).toMatchObject({
      sourceKey: "controlled-run:run-1:knowledge_asset",
      workflowRunId: "workflow-1",
      assetType: "sales_playbook",
      status: "active",
    });
  });

  it("skips after-approval writes when output is not approved", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;
    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: { ...previousResults[3], stepId: "writeback" },
      previousResults,
      approved: false,
    });

    expect(receipts).toHaveLength(2);
    expect(receipts.every((receipt) => !receipt.ok)).toBe(true);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });

  it("is idempotent for the same controlled run", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;
    const result: StepResult = {
      stepId: "writeback",
      status: "completed",
      output: { salesAssetUpdated: true, knowledgeAssetCandidate: "Approved body" },
      toolCallResults: [],
      tokensUsed: 0,
      durationMs: 1,
    };

    await writeControlledStepAssets({ run: makeRun(), step, result, previousResults, approved: true });
    await writeControlledStepAssets({ run: makeRun(), step, result, previousResults, approved: true });

    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(1);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: FAIL because `writeControlledStepAssets` does not exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "test: cover controlled run asset writeback"
```

---

### Task 2: Implement Real Controlled Writeback

**Files:**

- Modify: `src/lib/executor/runtime/writeback.ts`
- Test: `src/__tests__/lib/executor/runtime/writeback.test.ts`

- [ ] **Step 1: Add server writeback helpers**

In `src/lib/executor/runtime/writeback.ts`, add `writeControlledStepAssets(input)` alongside the existing receipt type usage. It must:

- return `[]` when `step.writesTo` is missing,
- skip `after_approval` targets when `approved` is false,
- call `upsertSalesAssetInStore` for `sales_asset`,
- call `upsertKnowledgeAssetInStore` for `knowledge_asset`,
- return unsupported receipts for `workflow_run` and `draft`.

- [ ] **Step 2: Preserve the existing receipt API**

Keep `buildWritebackReceipts` exported as a thin compatibility wrapper or migrate callers in Task 3. Do not remove exported names until all imports are updated.

- [ ] **Step 3: Run the focused writeback tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/lib/executor/runtime/writeback.ts src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "feat: write controlled run outputs to assets"
```

---

### Task 3: Persist Real Receipts From The Step Executor

**Files:**

- Modify: `src/lib/executor/step-executor.ts`
- Modify: `src/__tests__/lib/executor/runtime/resume.test.ts`

- [ ] **Step 1: Add a failing resume integration assertion**

Extend `src/__tests__/lib/executor/runtime/resume.test.ts` so the final approved `writeback` path asserts:

- the controlled run `writeback` step includes `sales_asset` and `knowledge_asset` receipts,
- the sales asset store has one completed asset,
- the knowledge asset store has one active sales playbook asset.

- [ ] **Step 2: Update executor writeback call**

In `src/lib/executor/step-executor.ts`, replace synthetic `buildWritebackReceipts` usage with `await writeControlledStepAssets(...)` when `shouldPersistControlledTrace` is true and the playbook step is known.

The call must pass:

- current controlled run context,
- current controlled playbook step,
- current `StepResult`,
- previous `trace.stepResults`,
- approval state for the step.

- [ ] **Step 3: Run resume tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [ ] **Step 5: Commit executor integration**

```bash
git add src/lib/executor/step-executor.ts src/__tests__/lib/executor/runtime/resume.test.ts
git commit -m "feat: persist controlled run writeback receipts"
```

---

### Task 4: Final Verification And Docs

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: this plan checklist

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Expected:

- controlled runtime tests pass,
- core workflow regressions pass,
- lint exits 0 with only the existing `<img>` warning if still present,
- build exits 0 with only the existing `<img>` warning if still present.

- [ ] **Step 2: Update docs**

Update:

- `CHANGELOG.md` with the asset writeback implementation,
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md` progress snapshot,
- this plan checklist.

- [ ] **Step 3: Commit verification docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-05-controlled-run-asset-writeback.md
git commit -m "docs: track controlled run asset writeback verification"
```

---

## Self-Review

Spec coverage:

- Real sales asset writeback is covered by Task 1 and Task 2.
- Real knowledge asset writeback is covered by Task 1 and Task 2.
- Durable run receipt persistence is covered by Task 3.
- Final regression is covered by Task 4.

Placeholder scan:

- No placeholder implementation steps are present.
- Unsupported `workflow_run` and `draft` targets are intentionally out of scope and must return explicit skipped receipts.

Type consistency:

- `writeControlledStepAssets` receives controlled run, playbook step, step result, previous results, and approval state.
- Receipts remain `ControlledWritebackReceipt[]`.
- Server writes use existing server stores, not browser-backed list state.

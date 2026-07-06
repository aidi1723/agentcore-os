# Governed Trace Fixture Builder CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local command that converts one governed trace artifact JSON file into validated governed fixture JSON on stdout.

**Architecture:** Keep the command as a pure maintenance script under `scripts/trace-fixtures/`. Reuse the existing TypeScript alias loader plus `buildControlledTraceFixture()` and `validateControlledTraceFixture()` so fixture safety stays centralized in the runtime fixture helper.

**Tech Stack:** Node.js ESM scripts, npm scripts, Vitest subprocess tests, existing `scripts/register-ts-alias-loader.mjs`, existing governed trace fixture builder/validator.

---

## File Structure

- Create `scripts/trace-fixtures/build-fixture.mjs`: local artifact-to-fixture command.
- Create `src/__tests__/scripts/trace-fixture-builder-script.test.ts`: subprocess coverage for success and missing-file failure.
- Modify `package.json`: add `trace:fixture:build` and include the script test in `test:controlled-runtime`.
- Modify docs and memory after verification.

---

### Task 1: Builder CLI Subprocess Test

**Files:**
- Create: `src/__tests__/scripts/trace-fixture-builder-script.test.ts`

- [x] **Step 1: Write the failing success and failure tests**

Create `src/__tests__/scripts/trace-fixture-builder-script.test.ts` with:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { ControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

const redacted = {
  redacted: true,
  reason: "trace_governance" as const,
  summary: "object(keys=raw)",
};

function makeArtifact(): ControlledTraceArtifact {
  return {
    id: "run-builder-1",
    requestId: "req-builder-1",
    sessionId: "session-builder-1",
    workflowRunId: "workflow-builder-1",
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
    auditEvents: [
      {
        id: "audit-builder-1",
        type: "approval_resolved",
        stepId: "human_review",
        createdAt: 160,
        actor: "local_user",
      },
    ],
    plan: {
      id: "playbook:sales-pipeline-v1:1.0.0",
      goal: { redacted: true, reason: "trace_governance", summary: "string(length=12)" },
      totalSteps: 5,
      requiresApproval: true,
      steps: [
        {
          id: "intake",
          title: "Intake",
          dependsOn: [],
          mode: "assist",
          writesTo: [],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "qualify",
          title: "Qualify",
          dependsOn: ["intake"],
          mode: "assist",
          writesTo: [{ target: "sales_asset", when: "on_success" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "draft_outreach",
          title: "Draft",
          dependsOn: ["qualify"],
          mode: "assist",
          writesTo: [{ target: "draft", when: "on_success" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "human_review",
          title: "Review",
          dependsOn: ["draft_outreach"],
          mode: "review",
          writesTo: [{ target: "workflow_run", when: "after_approval" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "writeback",
          title: "Writeback",
          dependsOn: ["human_review"],
          mode: "manual",
          writesTo: [{ target: "sales_asset", when: "after_approval" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
      ],
    },
    steps: [
      makeStep("intake"),
      makeStep("qualify"),
      makeStep("draft_outreach", {
        writebackReceipts: [
          {
            target: "draft",
            ok: true,
            summary: "Wrote draft controlled-draft:workflow-builder-1",
            writtenAt: 130,
            assetId: "controlled-draft:workflow-builder-1",
            sourceKey: "controlled-run:run-builder-1:draft",
            workflowRunId: "workflow-builder-1",
          },
        ],
      }),
      makeStep("human_review", {
        approval: {
          executionId: "run-builder-1",
          stepId: "human_review",
          state: "approved",
          requestedAt: 140,
          resolvedAt: 150,
          feedback: redacted,
          approver: "local_user",
        },
      }),
      makeStep("writeback", {
        schemaValidation: {
          valid: true,
          errors: [],
          checkedAt: 170,
        },
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Wrote sales asset sales-builder-1 for Nora with sk-builder-secret",
            writtenAt: 180,
            assetId: "sales-builder-1",
            sourceKey: "controlled-run:run-builder-1:sales_asset",
            workflowRunId: "workflow-builder-1",
          },
        ],
      }),
    ],
  };
}

function makeStep(
  stepId: string,
  overrides: Partial<ControlledTraceArtifact["steps"][number]> = {},
): ControlledTraceArtifact["steps"][number] {
  return {
    stepId,
    state: "completed",
    startedAt: 100,
    finishedAt: 120,
    input: redacted,
    output: redacted,
    attempts: 1,
    toolCallResults: [
      {
        toolName: "llm_generate",
        success: true,
        output: redacted,
        durationMs: 12,
        tokensUsed: 5,
      },
    ],
    writebackReceipts: [],
    ...overrides,
  };
}

describe("trace fixture builder script", () => {
  it("prints validated fixture JSON from a governed trace artifact file", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentcore-trace-fixture-"));
    const artifactPath = join(dir, "artifact.json");
    writeFileSync(artifactPath, JSON.stringify(makeArtifact(), null, 2));

    const result = spawnSync("npm", ["run", "trace:fixture:build", "--silent", "--", artifactPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const fixture = JSON.parse(result.stdout) as ControlledTraceFixture;
    const serialized = JSON.stringify(fixture);
    expect(fixture.schemaVersion).toBe("controlled-trace-fixture/v1");
    expect(fixture.sourceRunId).toBe("run-builder-1");
    expect(fixture.playbookId).toBe("sales-pipeline-v1");
    expect(fixture.assertions.stepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(fixture.steps[3].approvalState).toBe("approved");
    expect(fixture.steps[4].schemaValid).toBe(true);
    expect(fixture.steps[4].writebackTargets[0]).toMatchObject({
      target: "sales_asset",
      ok: true,
      assetId: "sales-builder-1",
    });
    expect(fixture.steps.every((step) => step.hasRedactedInput && step.hasRedactedOutput)).toBe(
      true,
    );
    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-builder-secret");
  });

  it("exits non-zero when the governed trace artifact file cannot be read", () => {
    const result = spawnSync(
      "npm",
      ["run", "trace:fixture:build", "--silent", "--", "/tmp/agentcore-missing-artifact.json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout.trim()).toBe("");
    expect(result.stderr).toContain("Failed to read governed trace artifact");
  });
});
```

- [x] **Step 2: Run the script test to verify RED**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-builder-script.test.ts
```

Expected: FAIL because `trace:fixture:build` is not defined and the builder script does not exist.

---

### Task 2: Builder CLI Implementation

**Files:**
- Create: `scripts/trace-fixtures/build-fixture.mjs`
- Modify: `package.json`

- [x] **Step 1: Add npm script**

In `package.json`, add near `trace:fixtures`:

```json
"trace:fixture:build": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/build-fixture.mjs",
```

- [x] **Step 2: Create the builder script**

Create `scripts/trace-fixtures/build-fixture.mjs` with:

```js
import { readFile } from "node:fs/promises";
import { buildControlledTraceFixture, validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

const artifactPath = process.argv[2];

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exitCode = 1;
}

if (!artifactPath) {
  fail("Usage: npm run trace:fixture:build -- <artifact.json>");
} else {
  let raw;
  try {
    raw = await readFile(artifactPath, "utf8");
  } catch (error) {
    fail(
      "Failed to read governed trace artifact",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (raw !== undefined) {
    let artifact;
    try {
      artifact = JSON.parse(raw);
    } catch (error) {
      fail(
        "Failed to parse governed trace artifact JSON",
        error instanceof Error ? error.message : String(error),
      );
    }

    if (artifact !== undefined) {
      const fixture = buildControlledTraceFixture(artifact);
      const validation = validateControlledTraceFixture(fixture);

      if (!validation.ok) {
        fail(
          "Governed trace artifact did not produce a valid fixture",
          validation.errors.map((item) => `- ${item}`).join("\n"),
        );
      } else {
        console.log(JSON.stringify(fixture, null, 2));
      }
    }
  }
}
```

- [x] **Step 3: Run the builder script test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-builder-script.test.ts
```

Expected: PASS.

- [x] **Step 4: Run manual builder command against test-created style input**

Run:

```bash
npm run trace:fixture:build --silent -- /tmp/agentcore-missing-artifact.json
```

Expected: non-zero exit and stderr includes `Failed to read governed trace artifact`.

- [x] **Step 5: Include script test in controlled runtime gate**

Modify `package.json` `test:controlled-runtime` to include:

```text
src/__tests__/scripts/trace-fixture-builder-script.test.ts
```

Place it after `src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts`.

- [x] **Step 6: Run focused fixture/script tests**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-builder-script.test.ts src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [x] **Step 7: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the new script test included.

- [x] **Step 8: Commit implementation**

```bash
git add package.json scripts/trace-fixtures/build-fixture.mjs src/__tests__/scripts/trace-fixture-builder-script.test.ts
git commit -m "test: add governed trace fixture builder cli"
```

---

### Task 3: Verification, Docs, And Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-governed-trace-fixture-builder-cli.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Run full verification before docs**

Run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 2: Update docs and records**

Record:

- script path `scripts/trace-fixtures/build-fixture.mjs`;
- npm command `npm run trace:fixture:build -- <artifact.json>`;
- stdout/stderr behavior;
- validation boundary;
- no writeback/no replay/no store mutation guarantee;
- controlled runtime test inclusion;
- next recommended phase.

- [x] **Step 3: Re-run final verification after docs**

Run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [x] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-governed-trace-fixture-builder-cli.md
git commit -m "docs: complete governed trace fixture builder cli"
```

---

## Plan Self-Review

- Spec coverage: artifact path input, stdout fixture JSON, stderr failures, validation, npm script, subprocess testing, controlled runtime gate, docs, and verification are covered.
- Scope check: the plan adds one local maintenance command only; no API, UI, store, catalog mutation, tool replay, or asset writeback.
- Placeholder scan: no task depends on unresolved placeholder work.
- Type consistency: the tests use existing `ControlledTraceArtifact` and `ControlledTraceFixture` types and the script uses existing fixture helper names.

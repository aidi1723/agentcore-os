import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

const redacted = {
  redacted: true,
  reason: "trace_governance" as const,
  summary: "object(keys=raw)",
};

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

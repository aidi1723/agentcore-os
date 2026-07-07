import { describe, expect, it } from "vitest";

import { auditControlledPlaybookCatalog } from "@/lib/executor/playbooks/control-audit";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const fixtureCatalog = [
  {
    id: "sales-pipeline-governed",
    playbookId: "sales-pipeline-v1",
  },
  {
    id: "support-resolution-governed",
    playbookId: "support-resolution-v1",
  },
];

describe("auditControlledPlaybookCatalog", () => {
  it("passes the registered controlled playbook control chain", () => {
    const report = auditControlledPlaybookCatalog({
      playbooks: [salesPipelinePlaybook, supportResolutionPlaybook],
      fixtureCatalog,
      fixtureCatalogReport: {
        ok: true,
        total: 2,
        passed: 2,
        failed: 0,
      },
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:control:audit",
      productionReady: false,
      publishingPerformed: false,
      auditOnly: true,
      summary: {
        playbooks: 2,
        steps: 10,
        approvalSteps: 4,
        writeTargets: 14,
        fixtures: 2,
        findings: 0,
      },
      findings: [],
      nextCommand: "npm run trace:fixtures --silent",
    });
    expect(report.items.map((item) => item.playbookId)).toEqual([
      "sales-pipeline-v1",
      "support-resolution-v1",
    ]);
    expect(report.items.map((item) => item.guardrails)).toEqual([
      {
        planValid: true,
        maxSteps: 10,
        maxToolCallsPerStep: 5,
        guardedTools: ["file_write", "code_execute"],
      },
      {
        planValid: true,
        maxSteps: 10,
        maxToolCallsPerStep: 5,
        guardedTools: ["file_write", "code_execute"],
      },
    ]);
    expect(report.items.map((item) => item.lifecycle)).toEqual([
      {
        status: "active",
        owner: "agentcore-runtime-maintainers",
        lastReviewedAt: "2026-07-07",
        reviewCadenceDays: 180,
        changePolicy: "spec_plan_tdd_fixture_required",
      },
      {
        status: "active",
        owner: "agentcore-runtime-maintainers",
        lastReviewedAt: "2026-07-07",
        reviewCadenceDays: 180,
        changePolicy: "spec_plan_tdd_fixture_required",
      },
    ]);
  });

  it("fails when a playbook writes to a target that is missing from resultAssets", () => {
    const driftedPlaybook = {
      ...supportResolutionPlaybook,
      resultAssets: ["support_asset", "knowledge_asset"],
    };

    const report = auditControlledPlaybookCatalog({
      playbooks: [driftedPlaybook],
      fixtureCatalog: [{ id: "support-resolution-governed", playbookId: "support-resolution-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "write_target_missing_from_result_assets",
      severity: "error",
      playbookId: "support-resolution-v1",
      stepId: "draft_reply",
      target: "draft",
      message:
        "Playbook support-resolution-v1 step draft_reply writes to draft but resultAssets does not declare it.",
    });
  });

  it("fails when a registered playbook has no committed governed fixture coverage", () => {
    const report = auditControlledPlaybookCatalog({
      playbooks: [salesPipelinePlaybook, supportResolutionPlaybook],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "missing_fixture_coverage",
      severity: "error",
      playbookId: "support-resolution-v1",
      message: "Registered playbook support-resolution-v1 has no committed governed fixture.",
    });
  });

  it("fails when fixture replay coverage is not green", () => {
    const report = auditControlledPlaybookCatalog({
      playbooks: [salesPipelinePlaybook],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: false,
        total: 1,
        passed: 0,
        failed: 1,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "fixture_replay_not_green",
      severity: "error",
      count: 1,
      message: "Committed governed fixture catalog report is not green.",
    });
  });

  it("fails when a resolved playbook plan exceeds default guardrail limits", () => {
    const oversizedPlaybook: ControlledPlaybook = {
      ...salesPipelinePlaybook,
      steps: [
        ...salesPipelinePlaybook.steps,
        ...Array.from({ length: 6 }, (_, index) => ({
          ...salesPipelinePlaybook.steps[index % salesPipelinePlaybook.steps.length],
          id: `extra_${index}`,
        })),
      ],
    };

    const report = auditControlledPlaybookCatalog({
      playbooks: [oversizedPlaybook],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.items[0].guardrails).toMatchObject({
      planValid: false,
      maxSteps: 10,
      maxToolCallsPerStep: 5,
      guardedTools: ["file_write", "code_execute"],
    });
    expect(report.findings).toContainEqual({
      code: "guardrail_plan_rejected",
      severity: "error",
      playbookId: "sales-pipeline-v1",
      message: "Resolved playbook sales-pipeline-v1 violates default guardrails: Plan has 11 steps, max is 10",
    });
  });

  it("fails when a guarded tool is used without declared playbook approval", () => {
    const fileWritePlaybook: ControlledPlaybook = {
      ...salesPipelinePlaybook,
      steps: salesPipelinePlaybook.steps.map((step) =>
        step.id === "qualify"
          ? {
              ...step,
              allowedTools: ["file_write"],
              toolCalls: [{ toolName: "file_write" }],
              requiresApproval: false,
            }
          : step,
      ),
    };

    const report = auditControlledPlaybookCatalog({
      playbooks: [fileWritePlaybook],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "guarded_tool_without_declared_approval",
      severity: "error",
      playbookId: "sales-pipeline-v1",
      stepId: "qualify",
      message:
        "Playbook sales-pipeline-v1 step qualify calls guarded tool file_write but does not declare approval.",
    });
  });

  it("fails when lifecycle metadata is missing", () => {
    const playbookWithoutLifecycle = {
      ...salesPipelinePlaybook,
      lifecycle: undefined,
    } as unknown as ControlledPlaybook;

    const report = auditControlledPlaybookCatalog({
      playbooks: [playbookWithoutLifecycle],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "missing_lifecycle_metadata",
      severity: "error",
      playbookId: "sales-pipeline-v1",
      message: "Playbook sales-pipeline-v1 must declare lifecycle metadata.",
    });
  });

  it("fails when lifecycle metadata is malformed", () => {
    const playbookWithBadLifecycle = {
      ...salesPipelinePlaybook,
      lifecycle: {
        status: "unknown",
        owner: "",
        lastReviewedAt: "07-07-2026",
        reviewCadenceDays: 0,
        changePolicy: "ad_hoc",
      },
    } as unknown as ControlledPlaybook;

    const report = auditControlledPlaybookCatalog({
      playbooks: [playbookWithBadLifecycle],
      fixtureCatalog: [{ id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" }],
      fixtureCatalogReport: {
        ok: true,
        total: 1,
        passed: 1,
        failed: 0,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_lifecycle_metadata",
          playbookId: "sales-pipeline-v1",
          message: "Playbook sales-pipeline-v1 lifecycle.status must be active, experimental, or deprecated.",
        }),
        expect.objectContaining({
          code: "invalid_lifecycle_metadata",
          playbookId: "sales-pipeline-v1",
          message: "Playbook sales-pipeline-v1 lifecycle.owner must be non-empty.",
        }),
        expect.objectContaining({
          code: "invalid_lifecycle_metadata",
          playbookId: "sales-pipeline-v1",
          message: "Playbook sales-pipeline-v1 lifecycle.lastReviewedAt must be YYYY-MM-DD.",
        }),
        expect.objectContaining({
          code: "invalid_lifecycle_metadata",
          playbookId: "sales-pipeline-v1",
          message: "Playbook sales-pipeline-v1 lifecycle.reviewCadenceDays must be a positive integer.",
        }),
        expect.objectContaining({
          code: "invalid_lifecycle_metadata",
          playbookId: "sales-pipeline-v1",
          message:
            "Playbook sales-pipeline-v1 lifecycle.changePolicy must be spec_plan_tdd_fixture_required.",
        }),
      ]),
    );
  });
});

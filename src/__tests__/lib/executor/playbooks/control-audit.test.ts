import { describe, expect, it } from "vitest";

import { auditControlledPlaybookCatalog } from "@/lib/executor/playbooks/control-audit";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";

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
});

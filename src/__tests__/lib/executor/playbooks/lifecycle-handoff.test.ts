import { describe, expect, it } from "vitest";

import { auditControlledPlaybookCatalog } from "@/lib/executor/playbooks/control-audit";
import { buildPlaybookLifecycleHandoffChecklist } from "@/lib/executor/playbooks/lifecycle-handoff";
import { reviewControlledPlaybookLifecycle } from "@/lib/executor/playbooks/lifecycle-review";
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

function buildControlAudit(playbooks: ControlledPlaybook[], fixtures = fixtureCatalog) {
  return auditControlledPlaybookCatalog({
    playbooks,
    fixtureCatalog: fixtures,
    fixtureCatalogReport: {
      ok: true,
      total: fixtures.length,
      passed: fixtures.length,
      failed: 0,
    },
  });
}

function buildDeprecatedSalesPlaybook(): ControlledPlaybook {
  return {
    ...salesPipelinePlaybook,
    id: "sales-pipeline-v0",
    scenarioId: "sales-pipeline-legacy",
    version: "0.9.0",
    lifecycle: {
      ...salesPipelinePlaybook.lifecycle,
      status: "deprecated",
      deprecatedAt: "2026-07-07",
      deprecationReason: "Replaced by the reviewed sales pipeline v1 playbook.",
      replacementPlaybookId: "sales-pipeline-v1",
    },
  };
}

describe("buildPlaybookLifecycleHandoffChecklist", () => {
  it("reports the current registered catalog as ready for local lifecycle handoff", () => {
    const playbooks = [salesPipelinePlaybook, supportResolutionPlaybook];
    const report = buildPlaybookLifecycleHandoffChecklist({
      controlAudit: buildControlAudit(playbooks),
      lifecycleReview: reviewControlledPlaybookLifecycle({
        playbooks,
        now: "2026-07-07",
      }),
    });

    expect(report).toMatchObject({
      ok: true,
      readyForLifecycleHandoff: true,
      command: "playbook:lifecycle:handoff",
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      summary: {
        playbooks: 2,
        activePlaybooks: 2,
        experimentalPlaybooks: 0,
        deprecatedPlaybooks: 0,
        controlFindings: 0,
        lifecycleReviewFindings: 0,
        findings: 0,
      },
      deprecatedReplacements: [],
      findings: [],
      nextCommand: "npm run trace:fixtures --silent",
    });
  });

  it("blocks lifecycle handoff when lifecycle review is due", () => {
    const playbooks = [salesPipelinePlaybook, supportResolutionPlaybook];
    const report = buildPlaybookLifecycleHandoffChecklist({
      controlAudit: buildControlAudit(playbooks),
      lifecycleReview: reviewControlledPlaybookLifecycle({
        playbooks,
        now: "2027-01-03",
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.readyForLifecycleHandoff).toBe(false);
    expect(report.findings).toContainEqual({
      code: "lifecycle_review_not_green",
      severity: "error",
      count: 2,
      message: "Playbook lifecycle review is not green.",
    });
    expect(report.nextCommand).toBe("npm run playbook:lifecycle:review");
  });

  it("summarizes deprecated replacement chains for handoff review", () => {
    const deprecatedPlaybook = buildDeprecatedSalesPlaybook();
    const playbooks = [deprecatedPlaybook, salesPipelinePlaybook];
    const report = buildPlaybookLifecycleHandoffChecklist({
      controlAudit: buildControlAudit(playbooks, [
        { id: "sales-pipeline-v0-governed", playbookId: "sales-pipeline-v0" },
        { id: "sales-pipeline-governed", playbookId: "sales-pipeline-v1" },
      ]),
      lifecycleReview: reviewControlledPlaybookLifecycle({
        playbooks,
        now: "2026-07-07",
      }),
    });

    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      playbooks: 2,
      activePlaybooks: 1,
      deprecatedPlaybooks: 1,
    });
    expect(report.deprecatedReplacements).toEqual([
      {
        playbookId: "sales-pipeline-v0",
        replacementPlaybookId: "sales-pipeline-v1",
        deprecatedAt: "2026-07-07",
        owner: "agentcore-runtime-maintainers",
        deprecationReason: "Replaced by the reviewed sales pipeline v1 playbook.",
      },
    ]);
  });
});

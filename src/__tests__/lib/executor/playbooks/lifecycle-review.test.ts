import { describe, expect, it } from "vitest";

import { reviewControlledPlaybookLifecycle } from "@/lib/executor/playbooks/lifecycle-review";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";

describe("reviewControlledPlaybookLifecycle", () => {
  it("reports the current active playbooks as not due on their review date", () => {
    const report = reviewControlledPlaybookLifecycle({
      playbooks: [salesPipelinePlaybook, supportResolutionPlaybook],
      now: "2026-07-07",
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:review",
      productionReady: false,
      publishingPerformed: false,
      diagnosticOnly: true,
      summary: {
        playbooks: 2,
        activePlaybooks: 2,
        due: 0,
        overdue: 0,
        findings: 0,
      },
      findings: [],
      nextCommand: "npm run playbook:control:audit",
    });
    expect(report.items.map((item) => item.nextReviewDueAt)).toEqual([
      "2027-01-03",
      "2027-01-03",
    ]);
    expect(report.items.map((item) => item.daysUntilReviewDue)).toEqual([180, 180]);
  });

  it("fails closed when active playbooks are due for lifecycle review", () => {
    const report = reviewControlledPlaybookLifecycle({
      playbooks: [salesPipelinePlaybook, supportResolutionPlaybook],
      now: "2027-01-03",
    });

    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      playbooks: 2,
      activePlaybooks: 2,
      due: 2,
      overdue: 0,
      findings: 2,
    });
    expect(report.findings).toContainEqual({
      code: "playbook_lifecycle_review_due",
      severity: "error",
      playbookId: "sales-pipeline-v1",
      owner: "agentcore-runtime-maintainers",
      lastReviewedAt: "2026-07-07",
      nextReviewDueAt: "2027-01-03",
      daysOverdue: 0,
      message:
        "Playbook sales-pipeline-v1 lifecycle review is due for owner agentcore-runtime-maintainers.",
    });
  });
});

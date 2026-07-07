import { describe, expect, it } from "vitest";

import {
  PROJECT_CLOSEOUT_CHECK_COMMAND,
  buildProjectCloseoutReadinessReport,
} from "@/lib/executor/playbooks/project-closeout-readiness";

function gateReport(overrides = {}) {
  return {
    ok: true,
    command: "example:gate",
    productionReady: false,
    publishingPerformed: false,
    findings: [],
    nextCommand: "npm run test:controlled-runtime",
    ...overrides,
  };
}

describe("buildProjectCloseoutReadinessReport", () => {
  it("marks the current controlled-runtime milestone ready while preserving production deferrals", () => {
    const report = buildProjectCloseoutReadinessReport({
      controlAuditReport: gateReport({
        command: "playbook:control:audit",
        auditOnly: true,
      }),
      maintenanceReadyReport: gateReport({
        command: "playbook:lifecycle:maintenance:ready",
        readinessOnly: true,
        readyForLifecycleMaintenance: true,
      }),
      mutationDryRunReport: gateReport({
        command: "playbook:lifecycle:mutation:dry-run:check",
        dryRunOnly: true,
        readyForLifecycleMutationDryRun: true,
      }),
      deliveryReadyReport: gateReport({
        command: "delivery:ready:check",
        releaseClaim: "local_delivery_demo_ready",
      }),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PROJECT_CLOSEOUT_CHECK_COMMAND,
      status: "current_milestone_closeout_ready",
      readyForCurrentMilestoneCloseout: true,
      productionReady: false,
      publishingPerformed: false,
      closeoutOnly: true,
      checks: {
        playbookControlAudit: { ok: true },
        lifecycleMaintenanceReady: { ok: true },
        lifecycleMutationDryRun: { ok: true },
        localDeliveryReady: { ok: true },
      },
      findings: [],
      nextCommand: "npm run test:controlled-runtime",
    });
    expect(report.closedForCurrentMilestone.map((gap) => gap.id)).toContain(
      "playbook_lifecycle_readonly_chain",
    );
    expect(report.deferredNextPhase.map((gap) => gap.id)).toEqual([
      "real_mutation_executor",
      "authoring_versioning_deprecation_ui",
      "unified_policy_guardrail_layer",
      "deeper_real_replay",
      "external_connector_writeback",
      "production_operations",
    ]);
  });

  it("fails closed when any required local gate is not green", () => {
    const report = buildProjectCloseoutReadinessReport({
      controlAuditReport: gateReport({
        command: "playbook:control:audit",
        auditOnly: true,
      }),
      maintenanceReadyReport: gateReport({
        command: "playbook:lifecycle:maintenance:ready",
        ok: false,
        status: "evidence_not_ready",
        findings: [{ code: "sequence_evidence_not_ready" }],
        nextCommand:
          "npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json",
      }),
      mutationDryRunReport: gateReport({
        command: "playbook:lifecycle:mutation:dry-run:check",
        dryRunOnly: true,
        readyForLifecycleMutationDryRun: true,
      }),
      deliveryReadyReport: gateReport({
        command: "delivery:ready:check",
        releaseClaim: "local_delivery_demo_ready",
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "closeout_not_ready",
      readyForCurrentMilestoneCloseout: false,
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "local_gate_not_green",
          gate: "lifecycleMaintenanceReady",
        }),
      ],
      nextCommand:
        "npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json",
    });
  });

  it("rejects a gate that claims production readiness or publishing", () => {
    const report = buildProjectCloseoutReadinessReport({
      controlAuditReport: gateReport({
        command: "playbook:control:audit",
        productionReady: true,
        auditOnly: true,
      }),
      maintenanceReadyReport: gateReport({
        command: "playbook:lifecycle:maintenance:ready",
        readinessOnly: true,
        readyForLifecycleMaintenance: true,
      }),
      mutationDryRunReport: gateReport({
        command: "playbook:lifecycle:mutation:dry-run:check",
        dryRunOnly: true,
        readyForLifecycleMutationDryRun: true,
      }),
      deliveryReadyReport: gateReport({
        command: "delivery:ready:check",
        releaseClaim: "local_delivery_demo_ready",
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "closeout_not_ready",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "closeout_boundary_breached",
          gate: "playbookControlAudit",
        }),
      ],
    });
  });
});

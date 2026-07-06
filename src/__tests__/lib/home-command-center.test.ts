import { describe, expect, it } from "vitest";

import { buildRuntimeCockpitSummary } from "@/lib/home-command-center";

describe("buildRuntimeCockpitSummary", () => {
  it("frames the home surface as a controlled playbook cockpit", () => {
    const summary = buildRuntimeCockpitSummary({
      runtimeReady: true,
      runtimeLabel: "Local Runtime",
      scenarioTitle: "Sales Intake Flow",
      workflowTitle: "Qualify and draft outreach",
      selectedRunState: "running",
      pendingApprovalCount: 2,
      runningCount: 1,
      failedCount: 0,
      language: "en-US",
    });

    expect(summary.title).toBe("Controlled Playbook Cockpit");
    expect(summary.subtitle).toBe("Sales Intake Flow · Qualify and draft outreach");
    expect(summary.primaryActionLabel).toBe("Open Runtime Console");
    expect(summary.secondaryActionLabel).toBe("Run controlled playbook");
    expect(summary.metrics).toEqual([
      {
        id: "playbook",
        label: "Playbook run",
        value: "Running",
        detail: "Current controlled execution state",
        tone: "neutral",
      },
      {
        id: "approvals",
        label: "Approvals",
        value: "2",
        detail: "Human review gates",
        tone: "warning",
      },
      {
        id: "recovery",
        label: "Recovery",
        value: "0",
        detail: "Failed or retryable runs",
        tone: "neutral",
      },
      {
        id: "governance",
        label: "Governance gate",
        value: "Ready",
        detail: "Local Runtime · governed trace and replay gates",
        tone: "success",
      },
    ]);
  });

  it("marks governance as warning when runtime is not ready", () => {
    const summary = buildRuntimeCockpitSummary({
      runtimeReady: false,
      runtimeLabel: "Local Runtime",
      scenarioTitle: null,
      workflowTitle: null,
      selectedRunState: null,
      pendingApprovalCount: 0,
      runningCount: 0,
      failedCount: 1,
      language: "en-US",
    });

    expect(summary.subtitle).toBe(
      "Select a controlled playbook to inspect execution state",
    );
    expect(summary.metrics.find((metric) => metric.id === "recovery")).toMatchObject({
      value: "1",
      tone: "danger",
    });
    expect(summary.metrics.find((metric) => metric.id === "governance")).toMatchObject({
      value: "Check",
      tone: "warning",
    });
  });
});

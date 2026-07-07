export const PROJECT_CLOSEOUT_CHECK_COMMAND = "project:closeout:check";

type GateReport = Record<string, unknown>;

type ProjectCloseoutGateKey =
  | "playbookControlAudit"
  | "lifecycleMaintenanceReady"
  | "lifecycleMutationDryRun"
  | "localDeliveryReady";

type ProjectCloseoutFinding = {
  code: "local_gate_not_green" | "closeout_boundary_breached";
  severity: "error";
  gate: ProjectCloseoutGateKey;
  command: string;
  message: string;
  nextCommand?: string;
};

type ProjectCloseoutGap = {
  id: string;
  status:
    | "closed_for_current_controlled_runtime_milestone"
    | "deferred_next_phase";
  reason: string;
};

type ProjectCloseoutReadinessInput = {
  controlAuditReport: GateReport;
  maintenanceReadyReport: GateReport;
  mutationDryRunReport: GateReport;
  deliveryReadyReport: GateReport;
};

const CLOSED_FOR_CURRENT_MILESTONE: ProjectCloseoutGap[] = [
  {
    id: "fixed_playbook_execution_contract",
    status: "closed_for_current_controlled_runtime_milestone",
    reason:
      "Registered playbooks now have audited step, schema, tool, approval, failure, writeback, lifecycle, and fixture contracts.",
  },
  {
    id: "playbook_lifecycle_readonly_chain",
    status: "closed_for_current_controlled_runtime_milestone",
    reason:
      "Lifecycle proposal, migration plan, sequence, evidence, freshness, doctor, maintenance readiness, approval, dry-run, and handoff gates are available as local read-only checks.",
  },
  {
    id: "local_delivery_demo_boundary",
    status: "closed_for_current_controlled_runtime_milestone",
    reason:
      "Local delivery demo readiness remains verifiable without claiming production readiness or publishing.",
  },
];

const DEFERRED_NEXT_PHASE: ProjectCloseoutGap[] = [
  {
    id: "real_mutation_executor",
    status: "deferred_next_phase",
    reason:
      "Registered playbook mutation is still gated by dry-run review; no automatic mutation executor is enabled in this milestone.",
  },
  {
    id: "authoring_versioning_deprecation_ui",
    status: "deferred_next_phase",
    reason:
      "Lifecycle authoring/versioning/deprecation is represented by JSON gates and docs, not a productized operator UI.",
  },
  {
    id: "unified_policy_guardrail_layer",
    status: "deferred_next_phase",
    reason:
      "Default guardrails are audited, but policy, approval, tool, failure, and writeback rules are not yet unified into one product-level policy layer.",
  },
  {
    id: "deeper_real_replay",
    status: "deferred_next_phase",
    reason:
      "Replay remains no-side-effect fixture and sandbox contract validation, not a real tool/API replay runner.",
  },
  {
    id: "external_connector_writeback",
    status: "deferred_next_phase",
    reason:
      "External connector writeback is still outside the current local controlled-runtime closeout boundary.",
  },
  {
    id: "production_operations",
    status: "deferred_next_phase",
    reason:
      "Deployment, long-running retention automation, monitoring, release tagging, artifact upload, and production incident operations remain future work.",
  },
];

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asFindingsCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function summarizeGate(report: GateReport) {
  return {
    ok: report.ok === true,
    command: asString(report.command),
    productionReady: report.productionReady === true,
    publishingPerformed: report.publishingPerformed === true,
    findings: asFindingsCount(report.findings),
    status: asString(report.status) || undefined,
    nextCommand: asString(report.nextCommand) || undefined,
  };
}

function gateSpecificReady(key: ProjectCloseoutGateKey, report: GateReport) {
  if (key === "playbookControlAudit") {
    return report.auditOnly === true;
  }
  if (key === "lifecycleMaintenanceReady") {
    return report.readyForLifecycleMaintenance === true;
  }
  if (key === "lifecycleMutationDryRun") {
    return report.readyForLifecycleMutationDryRun === true && report.dryRunOnly === true;
  }
  return report.releaseClaim === "local_delivery_demo_ready";
}

function gateLabel(key: ProjectCloseoutGateKey) {
  if (key === "playbookControlAudit") return "playbook control audit";
  if (key === "lifecycleMaintenanceReady") {
    return "playbook lifecycle maintenance readiness";
  }
  if (key === "lifecycleMutationDryRun") {
    return "playbook lifecycle mutation dry-run";
  }
  return "local delivery readiness";
}

function buildGateFindings(key: ProjectCloseoutGateKey, report: GateReport) {
  const findings: ProjectCloseoutFinding[] = [];
  const command = asString(report.command) || key;
  const nextCommand = asString(report.nextCommand) || undefined;
  const boundaryBreached =
    report.productionReady === true || report.publishingPerformed === true;

  if (boundaryBreached) {
    findings.push({
      code: "closeout_boundary_breached",
      severity: "error",
      gate: key,
      command,
      message: `${gateLabel(key)} must not claim production readiness or publishing during project closeout.`,
      nextCommand,
    });
  }

  if (report.ok !== true || !gateSpecificReady(key, report)) {
    findings.push({
      code: "local_gate_not_green",
      severity: "error",
      gate: key,
      command,
      message: `${gateLabel(key)} is not green for current milestone closeout.`,
      nextCommand,
    });
  }

  return findings;
}

function firstNextCommand(findings: ProjectCloseoutFinding[]) {
  const finding = findings.find((item) => item.nextCommand);
  return finding?.nextCommand ?? "npm run test:controlled-runtime";
}

export function buildProjectCloseoutReadinessReport(
  input: ProjectCloseoutReadinessInput,
) {
  const gates = {
    playbookControlAudit: input.controlAuditReport,
    lifecycleMaintenanceReady: input.maintenanceReadyReport,
    lifecycleMutationDryRun: input.mutationDryRunReport,
    localDeliveryReady: input.deliveryReadyReport,
  } satisfies Record<ProjectCloseoutGateKey, GateReport>;

  const findings = Object.entries(gates).flatMap(([key, report]) =>
    buildGateFindings(key as ProjectCloseoutGateKey, report),
  );
  const ok = findings.length === 0;
  const requiredGateEntries = Object.entries(gates);
  const greenGates = requiredGateEntries.filter(
    ([key, report]) =>
      report.ok === true &&
      gateSpecificReady(key as ProjectCloseoutGateKey, report) &&
      report.productionReady !== true &&
      report.publishingPerformed !== true,
  ).length;

  return {
    ok,
    command: PROJECT_CLOSEOUT_CHECK_COMMAND,
    status: ok
      ? "current_milestone_closeout_ready"
      : "closeout_not_ready",
    readyForCurrentMilestoneCloseout: ok,
    productionReady: false as const,
    publishingPerformed: false as const,
    closeoutOnly: true as const,
    scope: "current_controlled_runtime_milestone",
    summary: {
      requiredGates: requiredGateEntries.length,
      greenGates,
      findings: findings.length,
      closedForCurrentMilestone: CLOSED_FOR_CURRENT_MILESTONE.length,
      deferredNextPhase: DEFERRED_NEXT_PHASE.length,
    },
    checks: {
      playbookControlAudit: summarizeGate(input.controlAuditReport),
      lifecycleMaintenanceReady: summarizeGate(input.maintenanceReadyReport),
      lifecycleMutationDryRun: summarizeGate(input.mutationDryRunReport),
      localDeliveryReady: summarizeGate(input.deliveryReadyReport),
    },
    closedForCurrentMilestone: CLOSED_FOR_CURRENT_MILESTONE,
    deferredNextPhase: DEFERRED_NEXT_PHASE,
    findings,
    nextCommand: firstNextCommand(findings),
    nextAction: ok
      ? "Current controlled-runtime milestone can be closed locally; production, real mutation, UI authoring, connector, and operations work remain next-phase items."
      : "Fix the first failing local gate before closing the current controlled-runtime milestone.",
  };
}

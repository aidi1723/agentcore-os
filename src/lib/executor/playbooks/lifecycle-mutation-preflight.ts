export const PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND =
  "playbook:lifecycle:mutation:preflight:check";

type GateReport = Record<string, unknown>;

type MutationPreflightTarget = {
  kind: string;
  path: string;
  operation: string;
};

export type PlaybookLifecycleMutationPreflightFinding = {
  code:
    | "closeout_not_green"
    | "dry_run_not_green"
    | "approval_not_green"
    | "missing_update_contract_target"
    | "invalid_target_scope"
    | "execution_boundary_breached";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type ValidatePlaybookLifecycleMutationPreflightOptions = {
  dryRunPath?: string;
  evidencePath?: string;
  closeoutReport: GateReport;
  dryRunReport: GateReport;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asTargets(value: unknown): MutationPreflightTarget[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MutationPreflightTarget => {
    if (!isRecord(item)) return false;
    return (
      typeof item.kind === "string" &&
      typeof item.path === "string" &&
      typeof item.operation === "string"
    );
  });
}

function scopedPlaybookPath(path: string) {
  return (
    path.startsWith("src/lib/executor/playbooks/") &&
    path.endsWith(".ts") &&
    !path.startsWith("/") &&
    !path.includes("..")
  );
}

function closeoutOk(report: GateReport) {
  return (
    report.ok === true &&
    report.readyForCurrentMilestoneCloseout === true &&
    report.status === "current_milestone_closeout_ready" &&
    report.productionReady === false &&
    report.publishingPerformed === false &&
    report.closeoutOnly === true
  );
}

function dryRunOk(report: GateReport) {
  return (
    report.ok === true &&
    report.readyForLifecycleMutationDryRun === true &&
    report.status === "dry_run_ready" &&
    report.productionReady === false &&
    report.publishingPerformed === false &&
    report.dryRunOnly === true
  );
}

function approvalOk(report: GateReport) {
  const checks = isRecord(report.checks) ? report.checks : {};
  return checks.approvalOk === true;
}

function executionBoundaryChecks(boundary: Record<string, unknown>) {
  const requiredFalseFields = [
    "mutationPerformed",
    "fixtureRefreshPerformed",
    "storeWritesPerformed",
    "externalWritesPerformed",
    "publishingPerformed",
    "productionReady",
  ] as const;
  const breachedField = requiredFalseFields.find((field) => boundary[field] !== false);
  return {
    ok: boundary.dryRunOnly === true && breachedField === undefined,
    breachedField,
  };
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationPreflightFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("closeout_not_green")) return "closeout_not_green";
  if (codes.has("dry_run_not_green")) return "dry_run_not_green";
  if (codes.has("approval_not_green")) return "approval_not_green";
  if (findings.length > 0) return "preflight_not_valid";
  return "ready_for_mutation_executor_preflight";
}

function nextCommandForStatus(status: string, closeoutReport: GateReport) {
  if (status === "closeout_not_green") {
    return asString(closeoutReport.nextCommand) || "npm run project:closeout:check";
  }
  if (status === "dry_run_not_green" || status === "approval_not_green") {
    return "npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>";
  }
  if (status === "preflight_not_valid") {
    return "npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>";
  }
  return "npm run test:controlled-runtime";
}

export function validatePlaybookLifecycleMutationPreflight(
  dryRun: unknown,
  options: ValidatePlaybookLifecycleMutationPreflightOptions,
) {
  const dryRunRecord = isRecord(dryRun) ? dryRun : {};
  const closeoutReport = isRecord(options.closeoutReport)
    ? options.closeoutReport
    : {};
  const dryRunReport = isRecord(options.dryRunReport) ? options.dryRunReport : {};
  const targets = asTargets(dryRunRecord.plannedTargets);
  const executionBoundary = isRecord(dryRunRecord.executionBoundary)
    ? dryRunRecord.executionBoundary
    : {};
  const findings: PlaybookLifecycleMutationPreflightFinding[] = [];

  const closeoutGreen = closeoutOk(closeoutReport);
  if (!closeoutGreen) {
    findings.push({
      code: "closeout_not_green",
      severity: "error",
      message:
        "Project closeout gate must be green before lifecycle mutation preflight.",
    });
  }

  const dryRunGreen = dryRunOk(dryRunReport);
  if (!dryRunGreen) {
    findings.push({
      code: "dry_run_not_green",
      severity: "error",
      message:
        "Lifecycle mutation dry-run gate must be green before mutation preflight.",
    });
  }

  const approvalGreen = approvalOk(dryRunReport);
  if (!approvalGreen) {
    findings.push({
      code: "approval_not_green",
      severity: "error",
      message:
        "Lifecycle mutation approval must be green inside the dry-run report.",
    });
  }

  const updateTarget = targets.find(
    (target) =>
      target.kind === "registered_playbook_contract" &&
      target.operation === "update_contract",
  );
  const updateContractTargetPresent = Boolean(updateTarget);
  if (!updateContractTargetPresent) {
    findings.push({
      code: "missing_update_contract_target",
      severity: "error",
      field: "plannedTargets",
      message:
        "Mutation preflight requires at least one registered_playbook_contract update_contract target.",
    });
  }

  const invalidTarget = targets.find((target) => !scopedPlaybookPath(target.path));
  const targetScopeOk = targets.length > 0 && !invalidTarget;
  if (invalidTarget) {
    findings.push({
      code: "invalid_target_scope",
      severity: "error",
      field: "plannedTargets",
      path: invalidTarget.path,
      message:
        "Mutation preflight target paths must stay under src/lib/executor/playbooks/.",
    });
  }

  const boundaryCheck = executionBoundaryChecks(executionBoundary);
  if (!boundaryCheck.ok) {
    findings.push({
      code: "execution_boundary_breached",
      severity: "error",
      field: boundaryCheck.breachedField
        ? `executionBoundary.${boundaryCheck.breachedField}`
        : "executionBoundary.dryRunOnly",
      message:
        "Mutation preflight requires dry-run-only boundaries with no performed side effects.",
    });
  }

  const status = statusFromFindings(findings);
  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    preflightOnly: true as const,
    readyForLifecycleMutationPreflight: ok,
    status,
    dryRunPath: options.dryRunPath,
    evidencePath: options.evidencePath,
    dryRun: {
      dryRunId: asString(dryRunRecord.dryRunId),
      targetPlaybookId: asString(dryRunRecord.targetPlaybookId),
    },
    summary: {
      findings: findings.length,
      plannedTargets: targets.length,
      updateContractTargets: targets.filter(
        (target) =>
          target.kind === "registered_playbook_contract" &&
          target.operation === "update_contract",
      ).length,
    },
    checks: {
      closeoutOk: closeoutGreen,
      dryRunOk: dryRunGreen,
      approvalOk: approvalGreen,
      updateContractTargetPresent,
      targetScopeOk,
      executionBoundaryOk: boundaryCheck.ok,
    },
    findings,
    nextCommand: nextCommandForStatus(status, closeoutReport),
    nextAction: ok
      ? "Mutation preflight is ready for a manual mutation executor implementation review; no mutation has been performed."
      : "Fix mutation preflight findings before implementing or running any lifecycle mutation executor.",
  };
}

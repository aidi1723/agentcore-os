import type { PlaybookLifecycleMigrationPlanReport } from "@/lib/executor/playbooks/lifecycle-migration-plan";
import type { PlaybookLifecycleMutationApprovalReport } from "@/lib/executor/playbooks/lifecycle-mutation-approval";

export const PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND =
  "playbook:lifecycle:mutation:dry-run:check";

export type PlaybookLifecycleMutationDryRunTarget = {
  kind: "registered_playbook_contract";
  path: string;
  operation: "review_only" | "update_contract";
};

export type PlaybookLifecycleMutationDryRun = {
  dryRunId: string;
  approvalPath: string;
  migrationPlanPath: string;
  owner: string;
  createdAt: string;
  mutationType: "registered_playbook_contract_update";
  targetPlaybookId: string;
  plannedTargets: PlaybookLifecycleMutationDryRunTarget[];
  fixtureImpact: {
    expectedFixtureIds: string[];
    refreshRequired: boolean;
    notes: string[];
  };
  executionBoundary: {
    dryRunOnly: boolean;
    mutationPerformed: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
  };
};

export type PlaybookLifecycleMutationDryRunFinding = {
  code:
    | "invalid_dry_run_shape"
    | "approval_not_green"
    | "migration_plan_not_green"
    | "invalid_mutation_type"
    | "target_playbook_mismatch"
    | "missing_registered_playbook_target"
    | "invalid_target_path"
    | "invalid_fixture_impact"
    | "execution_boundary_breached";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

export type PlaybookLifecycleMutationDryRunReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  dryRunOnly: true;
  readyForLifecycleMutationDryRun: boolean;
  status:
    | "dry_run_ready"
    | "approval_not_green"
    | "migration_plan_not_green"
    | "dry_run_not_valid";
  dryRunPath?: string;
  approvalPath: string;
  migrationPlanPath: string;
  dryRun: {
    dryRunId: string;
    owner: string;
    targetPlaybookId: string;
  };
  summary: {
    findings: number;
    plannedTargets: number;
    expectedFixtureIds: number;
  };
  checks: {
    approvalOk: boolean;
    migrationPlanOk: boolean;
    mutationTypeOk: boolean;
    targetPlaybookAligned: boolean;
    registeredPlaybookTargetPresent: boolean;
    targetPathsScoped: boolean;
    fixtureImpactOk: boolean;
    executionBoundaryOk: boolean;
  };
  findings: PlaybookLifecycleMutationDryRunFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleMutationDryRunOptions = {
  dryRunPath?: string;
  approvalReport: PlaybookLifecycleMutationApprovalReport | Record<string, unknown>;
  migrationPlanReport: PlaybookLifecycleMigrationPlanReport | Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function asPlannedTargets(value: unknown): PlaybookLifecycleMutationDryRunTarget[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlaybookLifecycleMutationDryRunTarget => {
    if (!isRecord(item)) return false;
    return (
      item.kind === "registered_playbook_contract" &&
      typeof item.path === "string" &&
      (item.operation === "review_only" || item.operation === "update_contract")
    );
  });
}

function missingStringFinding(
  dryRunId: string,
  field: keyof PlaybookLifecycleMutationDryRun,
): PlaybookLifecycleMutationDryRunFinding {
  return {
    code: "invalid_dry_run_shape",
    severity: "error",
    field,
    message: `Lifecycle mutation dry-run ${dryRunId} must include non-empty ${field}.`,
  };
}

function isScopedPlaybookPath(path: string) {
  return (
    path.startsWith("src/lib/executor/playbooks/") &&
    path.endsWith(".ts") &&
    !path.startsWith("/") &&
    !path.includes("..")
  );
}

function expectedFixtureIdsFromReport(report: Record<string, unknown>) {
  const fixtureReview = isRecord(report.fixtureReview) ? report.fixtureReview : {};
  return asStringArray(fixtureReview.expectedFixtureIds);
}

function statusFromFindings(findings: PlaybookLifecycleMutationDryRunFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("approval_not_green")) return "approval_not_green";
  if (codes.has("migration_plan_not_green")) return "migration_plan_not_green";
  if (findings.length > 0) return "dry_run_not_valid";
  return "dry_run_ready";
}

function actionForStatus(status: PlaybookLifecycleMutationDryRunReport["status"]) {
  if (status === "dry_run_ready") {
    return "Dry-run contract is ready for the next manual lifecycle mutation review.";
  }
  if (status === "approval_not_green") {
    return "Fix lifecycle mutation approval before reviewing dry-run targets.";
  }
  if (status === "migration_plan_not_green") {
    return "Fix lifecycle migration plan before reviewing dry-run targets.";
  }
  return "Fix lifecycle mutation dry-run findings before changing registered playbooks or fixtures.";
}

export function validatePlaybookLifecycleMutationDryRun(
  dryRun: unknown,
  options: ValidatePlaybookLifecycleMutationDryRunOptions,
): PlaybookLifecycleMutationDryRunReport {
  const record = isRecord(dryRun) ? dryRun : {};
  const approvalReport = isRecord(options.approvalReport) ? options.approvalReport : {};
  const migrationPlanReport = isRecord(options.migrationPlanReport)
    ? options.migrationPlanReport
    : {};
  const dryRunId = asString(record.dryRunId) || "unknown";
  const approvalPath = asString(record.approvalPath);
  const migrationPlanPath = asString(record.migrationPlanPath);
  const owner = asString(record.owner);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const plannedTargets = asPlannedTargets(record.plannedTargets);
  const fixtureImpact = isRecord(record.fixtureImpact) ? record.fixtureImpact : {};
  const fixtureImpactIds = asStringArray(fixtureImpact.expectedFixtureIds);
  const expectedFixtureIds = expectedFixtureIdsFromReport(migrationPlanReport);
  const executionBoundary = isRecord(record.executionBoundary)
    ? record.executionBoundary
    : {};
  const findings: PlaybookLifecycleMutationDryRunFinding[] = [];

  for (const field of [
    "dryRunId",
    "approvalPath",
    "migrationPlanPath",
    "owner",
    "createdAt",
    "mutationType",
    "targetPlaybookId",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(dryRunId, field));
    }
  }

  const approvalOk =
    approvalReport.ok === true &&
    approvalReport.approvedForLifecycleMutation === true &&
    approvalReport.status === "approved_for_lifecycle_mutation" &&
    approvalReport.productionReady === false &&
    approvalReport.publishingPerformed === false &&
    approvalReport.approvalOnly === true;
  if (!approvalOk) {
    findings.push({
      code: "approval_not_green",
      severity: "error",
      path: approvalPath,
      message: `Lifecycle mutation dry-run ${dryRunId} requires a green mutation approval report.`,
    });
  }

  const migrationPlanOk =
    migrationPlanReport.ok === true &&
    migrationPlanReport.productionReady === false &&
    migrationPlanReport.publishingPerformed === false &&
    migrationPlanReport.planOnly === true;
  if (!migrationPlanOk) {
    findings.push({
      code: "migration_plan_not_green",
      severity: "error",
      path: migrationPlanPath,
      message: `Lifecycle mutation dry-run ${dryRunId} requires a green migration plan report.`,
    });
  }

  const mutationTypeOk = record.mutationType === "registered_playbook_contract_update";
  if (!mutationTypeOk) {
    findings.push({
      code: "invalid_mutation_type",
      severity: "error",
      field: "mutationType",
      message: `Lifecycle mutation dry-run ${dryRunId} mutationType must be registered_playbook_contract_update.`,
    });
  }

  const migrationPlan = isRecord(migrationPlanReport.plan) ? migrationPlanReport.plan : {};
  const targetPlaybookAligned =
    hasNonEmptyString(targetPlaybookId) &&
    targetPlaybookId === asString(migrationPlan.toPlaybookId);
  if (hasNonEmptyString(targetPlaybookId) && !targetPlaybookAligned) {
    findings.push({
      code: "target_playbook_mismatch",
      severity: "error",
      field: "targetPlaybookId",
      message: `Lifecycle mutation dry-run ${dryRunId} targetPlaybookId must match migration plan toPlaybookId.`,
    });
  }

  const registeredPlaybookTargetPresent = plannedTargets.some(
    (target) => target.kind === "registered_playbook_contract",
  );
  if (!registeredPlaybookTargetPresent) {
    findings.push({
      code: "missing_registered_playbook_target",
      severity: "error",
      field: "plannedTargets",
      message: `Lifecycle mutation dry-run ${dryRunId} must include a registered_playbook_contract planned target.`,
    });
  }

  const invalidTarget = plannedTargets.find((target) => !isScopedPlaybookPath(target.path));
  const targetPathsScoped = plannedTargets.length > 0 && !invalidTarget;
  if (invalidTarget) {
    findings.push({
      code: "invalid_target_path",
      severity: "error",
      field: "plannedTargets",
      path: invalidTarget.path,
      message: `Lifecycle mutation dry-run ${dryRunId} target paths must stay under src/lib/executor/playbooks/.`,
    });
  }

  const fixtureSet = new Set(fixtureImpactIds);
  const fixtureImpactOk =
    fixtureImpact.refreshRequired === false &&
    expectedFixtureIds.every((fixtureId) => fixtureSet.has(fixtureId));
  if (!fixtureImpactOk) {
    findings.push({
      code: "invalid_fixture_impact",
      severity: "error",
      field: "fixtureImpact.expectedFixtureIds",
      message: `Lifecycle mutation dry-run ${dryRunId} fixtureImpact must cover migration plan expected fixture ids without refreshing fixtures.`,
    });
  }

  const requiredFalseFields = [
    "mutationPerformed",
    "fixtureRefreshPerformed",
    "storeWritesPerformed",
    "externalWritesPerformed",
    "publishingPerformed",
    "productionReady",
  ] as const;
  const breachedField = requiredFalseFields.find(
    (field) => executionBoundary[field] !== false,
  );
  const executionBoundaryOk =
    executionBoundary.dryRunOnly === true && breachedField === undefined;
  if (!executionBoundaryOk) {
    findings.push({
      code: "execution_boundary_breached",
      severity: "error",
      field: breachedField
        ? `executionBoundary.${breachedField}`
        : "executionBoundary.dryRunOnly",
      message: `Lifecycle mutation dry-run ${dryRunId} must preserve dry-run-only execution boundaries.`,
    });
  }

  const status = statusFromFindings(findings);
  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    dryRunOnly: true,
    readyForLifecycleMutationDryRun: ok,
    status,
    dryRunPath: options.dryRunPath,
    approvalPath,
    migrationPlanPath,
    dryRun: {
      dryRunId,
      owner,
      targetPlaybookId,
    },
    summary: {
      findings: findings.length,
      plannedTargets: plannedTargets.length,
      expectedFixtureIds: fixtureImpactIds.length,
    },
    checks: {
      approvalOk,
      migrationPlanOk,
      mutationTypeOk,
      targetPlaybookAligned,
      registeredPlaybookTargetPresent,
      targetPathsScoped,
      fixtureImpactOk,
      executionBoundaryOk,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : asString(approvalReport.nextCommand) ||
        asString(migrationPlanReport.nextCommand) ||
        "npm run playbook:lifecycle:mutation:approval:check -- --approval <path>",
    nextAction: actionForStatus(status),
  };
}

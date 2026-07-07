import type { PlaybookLifecycleChangeProposalReport } from "@/lib/executor/playbooks/lifecycle-change-proposal";

export const PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND =
  "playbook:lifecycle:migration:plan:check";

export type PlaybookLifecycleMigrationType =
  | "new_playbook"
  | "version_update"
  | "deprecation";

export type PlaybookLifecycleMigrationPlanFixtureReview = {
  expectedFixtureIds: string[];
  refreshRequired: boolean;
  notes: string[];
};

export type PlaybookLifecycleMigrationPlan = {
  planId: string;
  proposalPath: string;
  migrationType: PlaybookLifecycleMigrationType;
  fromPlaybookId: string;
  toPlaybookId: string;
  owner: string;
  plannedChanges: string[];
  rollbackPlan: string[];
  requiredCommands: string[];
  fixtureReview: PlaybookLifecycleMigrationPlanFixtureReview;
  mutationPolicy: "no_mutation_until_plan_approved";
};

export type PlaybookLifecycleMigrationPlanFinding = {
  code:
    | "invalid_plan_shape"
    | "invalid_migration_type"
    | "invalid_referenced_proposal"
    | "proposal_plan_mismatch"
    | "missing_required_command"
    | "missing_planned_changes"
    | "missing_rollback_plan"
    | "missing_fixture_review"
    | "invalid_mutation_policy";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

export type PlaybookLifecycleMigrationPlanReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  planOnly: true;
  planPath?: string;
  proposalPath: string;
  plan: {
    planId: string;
    migrationType: string;
    fromPlaybookId: string;
    toPlaybookId: string;
    owner: string;
  };
  summary: {
    findings: number;
    requiredCommands: number;
    plannedChanges: number;
    rollbackSteps: number;
    expectedFixtureIds: number;
  };
  checks: {
    proposalOk: boolean;
    requiredCommandsPresent: number;
    plannedChanges: number;
    rollbackSteps: number;
    expectedFixtureIds: number;
    mutationPolicyOk: boolean;
  };
  findings: PlaybookLifecycleMigrationPlanFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleMigrationPlanOptions = {
  planPath?: string;
  proposalReport: PlaybookLifecycleChangeProposalReport;
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

function hasAllowedMigrationType(value: unknown): value is PlaybookLifecycleMigrationType {
  return value === "new_playbook" || value === "version_update" || value === "deprecation";
}

function requiredMigrationCommands(proposalPath: string) {
  return [
    `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
    "npm run playbook:lifecycle:handoff",
    "npm run trace:fixtures --silent",
    "npm run test:controlled-runtime",
  ];
}

function missingStringFinding(
  planId: string,
  field: keyof PlaybookLifecycleMigrationPlan,
): PlaybookLifecycleMigrationPlanFinding {
  return {
    code: "invalid_plan_shape",
    severity: "error",
    field,
    message: `Migration plan ${planId} must include non-empty ${field}.`,
  };
}

export function validatePlaybookLifecycleMigrationPlan(
  plan: unknown,
  options: ValidatePlaybookLifecycleMigrationPlanOptions,
): PlaybookLifecycleMigrationPlanReport {
  const record = isRecord(plan) ? plan : {};
  const planId = asString(record.planId) || "unknown";
  const proposalPath = asString(record.proposalPath);
  const migrationType = asString(record.migrationType);
  const fromPlaybookId = asString(record.fromPlaybookId);
  const toPlaybookId = asString(record.toPlaybookId);
  const owner = asString(record.owner);
  const plannedChanges = asStringArray(record.plannedChanges);
  const rollbackPlan = asStringArray(record.rollbackPlan);
  const requiredCommands = asStringArray(record.requiredCommands);
  const fixtureReview = isRecord(record.fixtureReview) ? record.fixtureReview : {};
  const expectedFixtureIds = asStringArray(fixtureReview.expectedFixtureIds);
  const requiredCommandsForPlan = requiredMigrationCommands(proposalPath);
  const findings: PlaybookLifecycleMigrationPlanFinding[] = [];

  for (const field of [
    "planId",
    "proposalPath",
    "migrationType",
    "fromPlaybookId",
    "toPlaybookId",
    "owner",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(planId, field));
    }
  }

  if (!hasAllowedMigrationType(record.migrationType)) {
    findings.push({
      code: "invalid_migration_type",
      severity: "error",
      field: "migrationType",
      message: `Migration plan ${planId} migrationType must be new_playbook, version_update, or deprecation.`,
    });
  }

  if (!options.proposalReport.ok) {
    findings.push({
      code: "invalid_referenced_proposal",
      severity: "error",
      path: proposalPath,
      message: `Migration plan ${planId} references a proposal that is not green.`,
    });
  }

  if (
    hasNonEmptyString(migrationType) &&
    options.proposalReport.proposal.changeType !== migrationType
  ) {
    findings.push({
      code: "proposal_plan_mismatch",
      severity: "error",
      field: "migrationType",
      message: `Migration plan ${planId} migrationType must match referenced proposal changeType.`,
    });
  }

  if (
    hasNonEmptyString(toPlaybookId) &&
    options.proposalReport.proposal.playbookId !== toPlaybookId
  ) {
    findings.push({
      code: "proposal_plan_mismatch",
      severity: "error",
      field: "toPlaybookId",
      message: `Migration plan ${planId} toPlaybookId must match referenced proposal playbookId.`,
    });
  }

  const commandSet = new Set(requiredCommands);
  for (const command of requiredCommandsForPlan) {
    if (!commandSet.has(command)) {
      findings.push({
        code: "missing_required_command",
        severity: "error",
        command,
        message: `Migration plan ${planId} must include required command: ${command}.`,
      });
    }
  }

  if (plannedChanges.length === 0) {
    findings.push({
      code: "missing_planned_changes",
      severity: "error",
      field: "plannedChanges",
      message: `Migration plan ${planId} must include plannedChanges.`,
    });
  }

  if (rollbackPlan.length === 0) {
    findings.push({
      code: "missing_rollback_plan",
      severity: "error",
      field: "rollbackPlan",
      message: `Migration plan ${planId} must include rollbackPlan.`,
    });
  }

  if (
    (record.migrationType === "new_playbook" || record.migrationType === "version_update") &&
    expectedFixtureIds.length === 0
  ) {
    findings.push({
      code: "missing_fixture_review",
      severity: "error",
      field: "fixtureReview.expectedFixtureIds",
      message: `Migration plan ${planId} must include fixtureReview.expectedFixtureIds for ${record.migrationType}.`,
    });
  }

  const mutationPolicyOk = record.mutationPolicy === "no_mutation_until_plan_approved";
  if (!mutationPolicyOk) {
    findings.push({
      code: "invalid_mutation_policy",
      severity: "error",
      field: "mutationPolicy",
      message: `Migration plan ${planId} mutationPolicy must be no_mutation_until_plan_approved.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    planOnly: true,
    ...(options.planPath ? { planPath: options.planPath } : {}),
    proposalPath,
    plan: {
      planId,
      migrationType,
      fromPlaybookId,
      toPlaybookId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommandsForPlan.length,
      plannedChanges: plannedChanges.length,
      rollbackSteps: rollbackPlan.length,
      expectedFixtureIds: expectedFixtureIds.length,
    },
    checks: {
      proposalOk: options.proposalReport.ok,
      requiredCommandsPresent: requiredCommandsForPlan.filter((command) =>
        commandSet.has(command),
      ).length,
      plannedChanges: plannedChanges.length,
      rollbackSteps: rollbackPlan.length,
      expectedFixtureIds: expectedFixtureIds.length,
      mutationPolicyOk,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : "npm run playbook:lifecycle:migration:plan:check",
    nextAction: ok
      ? "Migration plan contract is green; run lifecycle handoff before any playbook mutation."
      : "Fix migration plan findings before changing registered playbooks or fixtures.",
  };
}

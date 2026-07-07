export const PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND =
  "playbook:lifecycle:change:check";

export const REQUIRED_PLAYBOOK_LIFECYCLE_CHANGE_COMMANDS = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
] as const;

export type PlaybookLifecycleChangeType =
  | "new_playbook"
  | "version_update"
  | "deprecation";

export type PlaybookLifecycleChangeProposal = {
  proposalId: string;
  changeType: PlaybookLifecycleChangeType;
  playbookId: string;
  owner: string;
  reason: string;
  specPath: string;
  planPath: string;
  requiredCommands: string[];
  expectedFixtureIds: string[];
  riskNotes: string[];
  replacementPlaybookId?: string;
  deprecatedAt?: string;
};

export type PlaybookLifecycleChangeProposalFinding = {
  code:
    | "invalid_proposal_shape"
    | "invalid_change_type"
    | "missing_reference_file"
    | "missing_required_command"
    | "missing_fixture_expectation"
    | "missing_deprecation_metadata";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

export type PlaybookLifecycleChangeProposalReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  proposalOnly: true;
  proposalPath?: string;
  proposal: {
    proposalId: string;
    changeType: string;
    playbookId: string;
    owner: string;
  };
  summary: {
    findings: number;
    requiredCommands: number;
    expectedFixtureIds: number;
  };
  checks: {
    specPathExists: boolean;
    planPathExists: boolean;
    requiredCommandsPresent: number;
    expectedFixtureIds: number;
  };
  findings: PlaybookLifecycleChangeProposalFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleChangeProposalOptions = {
  proposalPath?: string;
  fileExists?: (path: string) => boolean;
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

function hasDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasAllowedChangeType(value: unknown): value is PlaybookLifecycleChangeType {
  return value === "new_playbook" || value === "version_update" || value === "deprecation";
}

function missingStringFinding(
  proposalId: string,
  field: keyof PlaybookLifecycleChangeProposal,
): PlaybookLifecycleChangeProposalFinding {
  return {
    code: "invalid_proposal_shape",
    severity: "error",
    field,
    message: `Proposal ${proposalId} must include non-empty ${field}.`,
  };
}

export function validatePlaybookLifecycleChangeProposal(
  proposal: unknown,
  options: ValidatePlaybookLifecycleChangeProposalOptions = {},
): PlaybookLifecycleChangeProposalReport {
  const record = isRecord(proposal) ? proposal : {};
  const proposalId = asString(record.proposalId) || "unknown";
  const changeType = asString(record.changeType);
  const playbookId = asString(record.playbookId);
  const owner = asString(record.owner);
  const specPath = asString(record.specPath);
  const planPath = asString(record.planPath);
  const requiredCommands = asStringArray(record.requiredCommands);
  const expectedFixtureIds = asStringArray(record.expectedFixtureIds);
  const findings: PlaybookLifecycleChangeProposalFinding[] = [];
  const fileExists = options.fileExists ?? (() => true);

  for (const field of ["proposalId", "playbookId", "owner", "reason", "specPath", "planPath"] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(proposalId, field));
    }
  }

  if (!hasAllowedChangeType(record.changeType)) {
    findings.push({
      code: "invalid_change_type",
      severity: "error",
      field: "changeType",
      message: `Proposal ${proposalId} changeType must be new_playbook, version_update, or deprecation.`,
    });
  }

  const specPathExists = hasNonEmptyString(specPath) && fileExists(specPath);
  const planPathExists = hasNonEmptyString(planPath) && fileExists(planPath);

  if (hasNonEmptyString(specPath) && !specPathExists) {
    findings.push({
      code: "missing_reference_file",
      severity: "error",
      field: "specPath",
      path: specPath,
      message: `Proposal ${proposalId} specPath does not exist: ${specPath}.`,
    });
  }
  if (hasNonEmptyString(planPath) && !planPathExists) {
    findings.push({
      code: "missing_reference_file",
      severity: "error",
      field: "planPath",
      path: planPath,
      message: `Proposal ${proposalId} planPath does not exist: ${planPath}.`,
    });
  }

  const requiredCommandSet = new Set(requiredCommands);
  for (const command of REQUIRED_PLAYBOOK_LIFECYCLE_CHANGE_COMMANDS) {
    if (!requiredCommandSet.has(command)) {
      findings.push({
        code: "missing_required_command",
        severity: "error",
        command,
        message: `Proposal ${proposalId} must include required command: ${command}.`,
      });
    }
  }

  if (
    (record.changeType === "new_playbook" || record.changeType === "version_update") &&
    expectedFixtureIds.length === 0
  ) {
    findings.push({
      code: "missing_fixture_expectation",
      severity: "error",
      field: "expectedFixtureIds",
      message: `Proposal ${proposalId} must include expectedFixtureIds for ${record.changeType}.`,
    });
  }

  if (record.changeType === "deprecation") {
    if (!hasNonEmptyString(record.replacementPlaybookId)) {
      findings.push({
        code: "missing_deprecation_metadata",
        severity: "error",
        field: "replacementPlaybookId",
        message: `Deprecation proposal ${proposalId} must include replacementPlaybookId.`,
      });
    }
    if (!hasDateOnly(record.deprecatedAt)) {
      findings.push({
        code: "missing_deprecation_metadata",
        severity: "error",
        field: "deprecatedAt",
        message: `Deprecation proposal ${proposalId} must include deprecatedAt.`,
      });
    }
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    proposalOnly: true,
    ...(options.proposalPath ? { proposalPath: options.proposalPath } : {}),
    proposal: {
      proposalId,
      changeType,
      playbookId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: REQUIRED_PLAYBOOK_LIFECYCLE_CHANGE_COMMANDS.length,
      expectedFixtureIds: expectedFixtureIds.length,
    },
    checks: {
      specPathExists,
      planPathExists,
      requiredCommandsPresent: REQUIRED_PLAYBOOK_LIFECYCLE_CHANGE_COMMANDS.filter(
        (command) => requiredCommandSet.has(command),
      ).length,
      expectedFixtureIds: expectedFixtureIds.length,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : "npm run playbook:lifecycle:change:check",
    nextAction: ok
      ? "Proposal contract is green; run lifecycle handoff before changing registered playbooks."
      : "Fix proposal findings before authoring, versioning, or deprecating a playbook.",
  };
}

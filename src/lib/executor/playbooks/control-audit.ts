import type {
  ControlledPlaybook,
  ControlledPlaybookLifecycle,
  ControlledPlaybookWriteTarget,
} from "@/lib/executor/playbooks/types";
import { DEFAULT_GUARDRAILS, validatePlan } from "@/lib/executor/guardrails";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { validateControlledPlaybook } from "@/lib/executor/playbooks/validator";

export const PLAYBOOK_CONTROL_AUDIT_COMMAND = "playbook:control:audit";

type FixtureCatalogEntry = {
  id: string;
  playbookId: string;
};

type FixtureCatalogReportLike = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
};

export type PlaybookControlAuditFinding = {
  code: string;
  severity: "error" | "warning";
  message: string;
  playbookId?: string;
  stepId?: string;
  target?: ControlledPlaybookWriteTarget;
  count?: number;
};

export type PlaybookControlAuditItem = {
  playbookId: string;
  scenarioId: string;
  version: string;
  steps: number;
  approvalSteps: number;
  writeTargets: ControlledPlaybookWriteTarget[];
  fixtureIds: string[];
  lifecycle?: ControlledPlaybookLifecycle;
  guardrails: {
    planValid: boolean;
    maxSteps: number;
    maxToolCallsPerStep: number;
    guardedTools: string[];
    rejectionReason?: string;
  };
  valid: boolean;
  errors: string[];
};

export type PlaybookControlAuditReport = {
  ok: boolean;
  command: typeof PLAYBOOK_CONTROL_AUDIT_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  auditOnly: true;
  summary: {
    playbooks: number;
    steps: number;
    approvalSteps: number;
    writeTargets: number;
    fixtures: number;
    findings: number;
  };
  items: PlaybookControlAuditItem[];
  fixtureCatalog: FixtureCatalogReportLike;
  findings: PlaybookControlAuditFinding[];
  nextCommand: string;
  nextAction: string;
};

type AuditControlledPlaybookCatalogInput = {
  playbooks: ControlledPlaybook[];
  fixtureCatalog: FixtureCatalogEntry[];
  fixtureCatalogReport: FixtureCatalogReportLike;
};

function finding(
  code: string,
  message: string,
  options: Omit<PlaybookControlAuditFinding, "code" | "severity" | "message"> = {},
): PlaybookControlAuditFinding {
  return {
    code,
    severity: "error",
    message,
    ...options,
  };
}

function pushDuplicateFindings(
  findings: PlaybookControlAuditFinding[],
  values: string[],
  code: string,
  label: string,
) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  for (const duplicate of duplicates) {
    findings.push(
      finding(code, `Duplicate ${label} in controlled playbook catalog: ${duplicate}.`, {
        playbookId: duplicate,
      }),
    );
  }
}

function collectWriteTargets(playbook: ControlledPlaybook) {
  const targets: ControlledPlaybookWriteTarget[] = [];

  for (const step of playbook.steps) {
    for (const write of step.writesTo ?? []) {
      targets.push(write.target);
    }
  }

  return Array.from(new Set(targets));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasValidLifecycleStatus(status: unknown) {
  return status === "active" || status === "experimental" || status === "deprecated";
}

function hasIsoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function auditPlaybookContract(
  playbook: ControlledPlaybook,
  fixtureIds: string[],
): PlaybookControlAuditItem {
  const validation = validateControlledPlaybook(playbook);
  const guardrailValidation = validatePlan(
    resolveExecutionPlanFromPlaybook(playbook),
    DEFAULT_GUARDRAILS,
  );
  return {
    playbookId: playbook.id,
    scenarioId: playbook.scenarioId,
    version: playbook.version,
    steps: playbook.steps.length,
    approvalSteps: playbook.steps.filter((step) => step.requiresApproval).length,
    writeTargets: collectWriteTargets(playbook),
    fixtureIds,
    ...(playbook.lifecycle ? { lifecycle: playbook.lifecycle } : {}),
    guardrails: {
      planValid: guardrailValidation.valid,
      maxSteps: DEFAULT_GUARDRAILS.maxSteps,
      maxToolCallsPerStep: DEFAULT_GUARDRAILS.maxToolCallsPerStep,
      guardedTools: DEFAULT_GUARDRAILS.requireApprovalFor,
      ...(guardrailValidation.reason ? { rejectionReason: guardrailValidation.reason } : {}),
    },
    valid: validation.valid,
    errors: validation.errors,
  };
}

function auditPlaybookFindings(
  playbook: ControlledPlaybook,
  fixtureIds: string[],
): PlaybookControlAuditFinding[] {
  const findings: PlaybookControlAuditFinding[] = [];
  const validation = validateControlledPlaybook(playbook);
  const guardrailValidation = validatePlan(
    resolveExecutionPlanFromPlaybook(playbook),
    DEFAULT_GUARDRAILS,
  );
  const declaredResultAssets = new Set(playbook.resultAssets);
  const seenStepIds = new Set<string>();
  const guardedTools = new Set(DEFAULT_GUARDRAILS.requireApprovalFor);
  const lifecycle = playbook.lifecycle;

  if (!playbook.id.trim()) {
    findings.push(finding("missing_playbook_id", "Playbook id is required."));
  }
  if (!playbook.scenarioId.trim()) {
    findings.push(
      finding("missing_scenario_id", `Playbook ${playbook.id} scenarioId is required.`, {
        playbookId: playbook.id,
      }),
    );
  }
  if (playbook.steps.length === 0) {
    findings.push(
      finding("missing_steps", `Playbook ${playbook.id} must declare at least one step.`, {
        playbookId: playbook.id,
      }),
    );
  }
  if (fixtureIds.length === 0) {
    findings.push(
      finding(
        "missing_fixture_coverage",
        `Registered playbook ${playbook.id} has no committed governed fixture.`,
        { playbookId: playbook.id },
      ),
    );
  }

  if (!isRecord(lifecycle)) {
    findings.push(
      finding(
        "missing_lifecycle_metadata",
        `Playbook ${playbook.id} must declare lifecycle metadata.`,
        { playbookId: playbook.id },
      ),
    );
  } else {
    if (!hasValidLifecycleStatus(lifecycle.status)) {
      findings.push(
        finding(
          "invalid_lifecycle_metadata",
          `Playbook ${playbook.id} lifecycle.status must be active, experimental, or deprecated.`,
          { playbookId: playbook.id },
        ),
      );
    }
    if (typeof lifecycle.owner !== "string" || lifecycle.owner.trim().length === 0) {
      findings.push(
        finding(
          "invalid_lifecycle_metadata",
          `Playbook ${playbook.id} lifecycle.owner must be non-empty.`,
          { playbookId: playbook.id },
        ),
      );
    }
    if (!hasIsoDate(lifecycle.lastReviewedAt)) {
      findings.push(
        finding(
          "invalid_lifecycle_metadata",
          `Playbook ${playbook.id} lifecycle.lastReviewedAt must be YYYY-MM-DD.`,
          { playbookId: playbook.id },
        ),
      );
    }
    if (
      !Number.isInteger(lifecycle.reviewCadenceDays) ||
      lifecycle.reviewCadenceDays <= 0
    ) {
      findings.push(
        finding(
          "invalid_lifecycle_metadata",
          `Playbook ${playbook.id} lifecycle.reviewCadenceDays must be a positive integer.`,
          { playbookId: playbook.id },
        ),
      );
    }
    if (lifecycle.changePolicy !== "spec_plan_tdd_fixture_required") {
      findings.push(
        finding(
          "invalid_lifecycle_metadata",
          `Playbook ${playbook.id} lifecycle.changePolicy must be spec_plan_tdd_fixture_required.`,
          { playbookId: playbook.id },
        ),
      );
    }
  }

  for (const error of validation.errors) {
    findings.push(
      finding("playbook_validation_error", error, {
        playbookId: playbook.id,
      }),
    );
  }

  if (!guardrailValidation.valid) {
    findings.push(
      finding(
        "guardrail_plan_rejected",
        `Resolved playbook ${playbook.id} violates default guardrails: ${guardrailValidation.reason}`,
        { playbookId: playbook.id },
      ),
    );
  }

  for (const step of playbook.steps) {
    if (seenStepIds.has(step.id)) {
      findings.push(
        finding("duplicate_step_id", `Duplicate step id ${step.id} in playbook ${playbook.id}.`, {
          playbookId: playbook.id,
          stepId: step.id,
        }),
      );
    }
    seenStepIds.add(step.id);

    if (!step.outputSchema.required || step.outputSchema.required.length === 0) {
      findings.push(
        finding(
          "missing_required_output_fields",
          `Playbook ${playbook.id} step ${step.id} must declare required output fields.`,
          { playbookId: playbook.id, stepId: step.id },
        ),
      );
    }

    if (step.onFailure.action === "retry") {
      const maxRetries = step.onFailure.maxRetries ?? 0;
      if (!Number.isInteger(maxRetries) || maxRetries <= 0) {
        findings.push(
          finding(
            "invalid_retry_policy",
            `Playbook ${playbook.id} step ${step.id} retry policy requires a positive maxRetries value.`,
            { playbookId: playbook.id, stepId: step.id },
          ),
        );
      }
    }

    for (const toolCall of step.toolCalls ?? []) {
      if (guardedTools.has(toolCall.toolName) && !step.requiresApproval) {
        findings.push(
          finding(
            "guarded_tool_without_declared_approval",
            `Playbook ${playbook.id} step ${step.id} calls guarded tool ${toolCall.toolName} but does not declare approval.`,
            { playbookId: playbook.id, stepId: step.id },
          ),
        );
      }
    }

    for (const write of step.writesTo ?? []) {
      if (write.when === "after_approval" && !step.requiresApproval) {
        findings.push(
          finding(
            "write_after_approval_without_approval_gate",
            `Playbook ${playbook.id} step ${step.id} writes to ${write.target} after approval but does not require approval.`,
            { playbookId: playbook.id, stepId: step.id, target: write.target },
          ),
        );
      }
      if (!declaredResultAssets.has(write.target)) {
        findings.push(
          finding(
            "write_target_missing_from_result_assets",
            `Playbook ${playbook.id} step ${step.id} writes to ${write.target} but resultAssets does not declare it.`,
            { playbookId: playbook.id, stepId: step.id, target: write.target },
          ),
        );
      }
    }
  }

  return findings;
}

function chooseNextCommand(ok: boolean) {
  if (ok) return "npm run trace:fixtures --silent";
  return "npm run playbook:control:audit";
}

function chooseNextAction(ok: boolean) {
  if (ok) {
    return "Playbook control-chain audit is green; keep governed fixture replay as the next contract gate.";
  }
  return "Fix the reported playbook control-chain findings before expanding playbooks, replay depth, UI, or release handoff scope.";
}

export function auditControlledPlaybookCatalog({
  playbooks,
  fixtureCatalog,
  fixtureCatalogReport,
}: AuditControlledPlaybookCatalogInput): PlaybookControlAuditReport {
  const findings: PlaybookControlAuditFinding[] = [];
  const fixtureIdsByPlaybook = new Map<string, string[]>();

  for (const entry of fixtureCatalog) {
    const existing = fixtureIdsByPlaybook.get(entry.playbookId) ?? [];
    fixtureIdsByPlaybook.set(entry.playbookId, [...existing, entry.id]);
  }

  pushDuplicateFindings(
    findings,
    playbooks.map((playbook) => playbook.id),
    "duplicate_playbook_id",
    "playbook id",
  );
  pushDuplicateFindings(
    findings,
    playbooks.map((playbook) => playbook.scenarioId),
    "duplicate_scenario_id",
    "scenario id",
  );
  pushDuplicateFindings(
    findings,
    fixtureCatalog.map((entry) => entry.playbookId),
    "duplicate_fixture_playbook_coverage",
    "fixture playbook coverage",
  );

  if (!fixtureCatalogReport.ok) {
    findings.push(
      finding("fixture_replay_not_green", "Committed governed fixture catalog report is not green.", {
        count: fixtureCatalogReport.failed,
      }),
    );
  }

  const items = playbooks.map((playbook) => {
    const fixtureIds = fixtureIdsByPlaybook.get(playbook.id) ?? [];
    findings.push(...auditPlaybookFindings(playbook, fixtureIds));
    return auditPlaybookContract(playbook, fixtureIds);
  });
  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_CONTROL_AUDIT_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    auditOnly: true,
    summary: {
      playbooks: playbooks.length,
      steps: items.reduce((total, item) => total + item.steps, 0),
      approvalSteps: items.reduce((total, item) => total + item.approvalSteps, 0),
      writeTargets: playbooks.reduce(
        (total, playbook) =>
          total + playbook.steps.reduce((count, step) => count + (step.writesTo?.length ?? 0), 0),
        0,
      ),
      fixtures: fixtureCatalog.length,
      findings: findings.length,
    },
    items,
    fixtureCatalog: {
      ok: fixtureCatalogReport.ok,
      total: fixtureCatalogReport.total,
      passed: fixtureCatalogReport.passed,
      failed: fixtureCatalogReport.failed,
    },
    findings,
    nextCommand: chooseNextCommand(ok),
    nextAction: chooseNextAction(ok),
  };
}

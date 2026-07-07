import type { PlaybookControlAuditReport } from "@/lib/executor/playbooks/control-audit";
import type { PlaybookLifecycleReviewReport } from "@/lib/executor/playbooks/lifecycle-review";

export const PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND = "playbook:lifecycle:handoff";

export type PlaybookLifecycleHandoffFinding = {
  code: "control_audit_not_green" | "lifecycle_review_not_green";
  severity: "error";
  message: string;
  count: number;
};

export type PlaybookLifecycleHandoffDeprecatedReplacement = {
  playbookId: string;
  replacementPlaybookId: string;
  deprecatedAt: string;
  owner: string;
  deprecationReason: string;
};

export type PlaybookLifecycleHandoffReport = {
  ok: boolean;
  readyForLifecycleHandoff: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  handoffOnly: true;
  summary: {
    playbooks: number;
    activePlaybooks: number;
    experimentalPlaybooks: number;
    deprecatedPlaybooks: number;
    controlFindings: number;
    lifecycleReviewFindings: number;
    findings: number;
  };
  checks: {
    controlAudit: {
      ok: boolean;
      command: PlaybookControlAuditReport["command"];
      findings: number;
    };
    lifecycleReview: {
      ok: boolean;
      command: PlaybookLifecycleReviewReport["command"];
      findings: number;
      now: string;
    };
  };
  deprecatedReplacements: PlaybookLifecycleHandoffDeprecatedReplacement[];
  findings: PlaybookLifecycleHandoffFinding[];
  nextCommand: string;
  nextAction: string;
};

type BuildPlaybookLifecycleHandoffChecklistInput = {
  controlAudit: PlaybookControlAuditReport;
  lifecycleReview: PlaybookLifecycleReviewReport;
};

function countLifecycleStatus(
  controlAudit: PlaybookControlAuditReport,
  status: "active" | "experimental" | "deprecated",
) {
  return controlAudit.items.filter((item) => item.lifecycle?.status === status).length;
}

function collectDeprecatedReplacements(
  controlAudit: PlaybookControlAuditReport,
): PlaybookLifecycleHandoffDeprecatedReplacement[] {
  return controlAudit.items
    .filter((item) => item.lifecycle?.status === "deprecated")
    .map((item) => ({
      playbookId: item.playbookId,
      replacementPlaybookId: item.lifecycle?.replacementPlaybookId ?? "",
      deprecatedAt: item.lifecycle?.deprecatedAt ?? "",
      owner: item.lifecycle?.owner ?? "",
      deprecationReason: item.lifecycle?.deprecationReason ?? "",
    }));
}

function chooseNextCommand(controlAuditOk: boolean, lifecycleReviewOk: boolean) {
  if (!controlAuditOk) return "npm run playbook:control:audit";
  if (!lifecycleReviewOk) return "npm run playbook:lifecycle:review";
  return "npm run trace:fixtures --silent";
}

function chooseNextAction(controlAuditOk: boolean, lifecycleReviewOk: boolean) {
  if (!controlAuditOk) {
    return "Fix playbook control-audit findings before handoff.";
  }
  if (!lifecycleReviewOk) {
    return "Review due playbooks before lifecycle handoff.";
  }
  return "Lifecycle handoff checklist is green; keep governed fixture replay as the next contract gate.";
}

export function buildPlaybookLifecycleHandoffChecklist({
  controlAudit,
  lifecycleReview,
}: BuildPlaybookLifecycleHandoffChecklistInput): PlaybookLifecycleHandoffReport {
  const findings: PlaybookLifecycleHandoffFinding[] = [];

  if (!controlAudit.ok) {
    findings.push({
      code: "control_audit_not_green",
      severity: "error",
      count: controlAudit.findings.length,
      message: "Playbook control audit is not green.",
    });
  }
  if (!lifecycleReview.ok) {
    findings.push({
      code: "lifecycle_review_not_green",
      severity: "error",
      count: lifecycleReview.findings.length,
      message: "Playbook lifecycle review is not green.",
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    readyForLifecycleHandoff: ok,
    command: PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    handoffOnly: true,
    summary: {
      playbooks: controlAudit.summary.playbooks,
      activePlaybooks: countLifecycleStatus(controlAudit, "active"),
      experimentalPlaybooks: countLifecycleStatus(controlAudit, "experimental"),
      deprecatedPlaybooks: countLifecycleStatus(controlAudit, "deprecated"),
      controlFindings: controlAudit.findings.length,
      lifecycleReviewFindings: lifecycleReview.findings.length,
      findings: findings.length,
    },
    checks: {
      controlAudit: {
        ok: controlAudit.ok,
        command: controlAudit.command,
        findings: controlAudit.findings.length,
      },
      lifecycleReview: {
        ok: lifecycleReview.ok,
        command: lifecycleReview.command,
        findings: lifecycleReview.findings.length,
        now: lifecycleReview.now,
      },
    },
    deprecatedReplacements: collectDeprecatedReplacements(controlAudit),
    findings,
    nextCommand: chooseNextCommand(controlAudit.ok, lifecycleReview.ok),
    nextAction: chooseNextAction(controlAudit.ok, lifecycleReview.ok),
  };
}

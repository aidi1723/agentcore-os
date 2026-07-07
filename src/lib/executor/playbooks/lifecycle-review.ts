import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

export const PLAYBOOK_LIFECYCLE_REVIEW_COMMAND = "playbook:lifecycle:review";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PlaybookLifecycleReviewFinding = {
  code: "playbook_lifecycle_review_due";
  severity: "error";
  message: string;
  playbookId: string;
  owner: string;
  lastReviewedAt: string;
  nextReviewDueAt: string;
  daysOverdue: number;
};

export type PlaybookLifecycleReviewItem = {
  playbookId: string;
  scenarioId: string;
  version: string;
  status: "active";
  owner: string;
  lastReviewedAt: string;
  reviewCadenceDays: number;
  nextReviewDueAt: string;
  daysUntilReviewDue: number;
};

export type PlaybookLifecycleReviewReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_REVIEW_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  diagnosticOnly: true;
  now: string;
  summary: {
    playbooks: number;
    activePlaybooks: number;
    due: number;
    overdue: number;
    findings: number;
  };
  items: PlaybookLifecycleReviewItem[];
  findings: PlaybookLifecycleReviewFinding[];
  nextCommand: string;
  nextAction: string;
};

type ReviewControlledPlaybookLifecycleInput = {
  playbooks: ControlledPlaybook[];
  now?: string;
};

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected YYYY-MM-DD date, got: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Expected valid YYYY-MM-DD date, got: ${value}`);
  }
  return date;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentDateOnly() {
  return formatDateOnly(new Date());
}

function addDays(dateValue: string, days: number) {
  const date = parseDateOnly(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function diffDays(fromDateValue: string, toDateValue: string) {
  return Math.round(
    (parseDateOnly(toDateValue).getTime() - parseDateOnly(fromDateValue).getTime()) /
      MS_PER_DAY,
  );
}

function buildDueFinding(item: PlaybookLifecycleReviewItem): PlaybookLifecycleReviewFinding {
  return {
    code: "playbook_lifecycle_review_due",
    severity: "error",
    playbookId: item.playbookId,
    owner: item.owner,
    lastReviewedAt: item.lastReviewedAt,
    nextReviewDueAt: item.nextReviewDueAt,
    daysOverdue: Math.max(0, -item.daysUntilReviewDue),
    message: `Playbook ${item.playbookId} lifecycle review is due for owner ${item.owner}.`,
  };
}

export function reviewControlledPlaybookLifecycle({
  playbooks,
  now = currentDateOnly(),
}: ReviewControlledPlaybookLifecycleInput): PlaybookLifecycleReviewReport {
  const items = playbooks
    .filter((playbook) => playbook.lifecycle.status === "active")
    .map((playbook): PlaybookLifecycleReviewItem => {
      const nextReviewDueAt = addDays(
        playbook.lifecycle.lastReviewedAt,
        playbook.lifecycle.reviewCadenceDays,
      );
      return {
        playbookId: playbook.id,
        scenarioId: playbook.scenarioId,
        version: playbook.version,
        status: "active",
        owner: playbook.lifecycle.owner,
        lastReviewedAt: playbook.lifecycle.lastReviewedAt,
        reviewCadenceDays: playbook.lifecycle.reviewCadenceDays,
        nextReviewDueAt,
        daysUntilReviewDue: diffDays(now, nextReviewDueAt),
      };
    });

  const dueItems = items.filter((item) => item.daysUntilReviewDue <= 0);
  const overdueItems = items.filter((item) => item.daysUntilReviewDue < 0);
  const findings = dueItems.map(buildDueFinding);

  return {
    ok: findings.length === 0,
    command: PLAYBOOK_LIFECYCLE_REVIEW_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    diagnosticOnly: true,
    now,
    summary: {
      playbooks: playbooks.length,
      activePlaybooks: items.length,
      due: dueItems.length,
      overdue: overdueItems.length,
      findings: findings.length,
    },
    items,
    findings,
    nextCommand: "npm run playbook:control:audit",
    nextAction:
      findings.length === 0
        ? "Lifecycle review diagnostic is green; keep the control audit as the next contract gate."
        : "Review due playbooks, update lifecycle.lastReviewedAt after the governed review, then rerun this command.",
  };
}

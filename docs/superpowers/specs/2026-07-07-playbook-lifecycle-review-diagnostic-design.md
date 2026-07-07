# Playbook Lifecycle Review Diagnostic Design

## Goal

Add a local read-only diagnostic command that tells maintainers when active registered controlled playbooks are due or overdue for lifecycle review.

## Context

Registered playbooks now declare lifecycle metadata, but the project still needs a maintainer workflow around that metadata. The next smallest useful step is not a UI or authoring system; it is a machine-readable command that turns `lastReviewedAt` and `reviewCadenceDays` into an actionable review status.

## Design

Add `npm run playbook:lifecycle:review`.

The command will:

- read the registered controlled playbook catalog;
- inspect only playbooks with `lifecycle.status === "active"`;
- compute `nextReviewDueAt = lastReviewedAt + reviewCadenceDays`;
- report `daysUntilReviewDue` for each active playbook;
- fail closed when any active playbook is due today or overdue;
- support `--now YYYY-MM-DD` for deterministic tests and maintenance checks;
- emit JSON with `productionReady: false`, `publishingPerformed: false`, and `diagnosticOnly: true`.

Due or overdue playbooks should produce `playbook_lifecycle_review_due` findings that name the playbook, owner, last review date, next due date, and days overdue.

## Boundaries

No runtime execution, no tool calls, no fixture mutation, no UI, no authoring screen, no version migration, no deprecation workflow, no external connector writes, no release, no browser smoke, and no production-readiness claim.

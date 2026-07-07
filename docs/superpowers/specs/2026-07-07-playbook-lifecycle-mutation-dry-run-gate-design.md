# Playbook Lifecycle Mutation Dry-Run Gate Design

## Goal

Add one local read-only dry-run gate after lifecycle mutation approval and before any real playbook lifecycle mutation. The gate makes the proposed mutation target, fixture impact, and side-effect boundary explicit before maintainers edit registered playbook files.

## Context

The lifecycle maintenance chain now reaches structured approval:

- proposal;
- migration plan;
- maintenance sequence;
- recorded sequence evidence;
- freshness / doctor;
- maintenance readiness;
- mutation approval receipt.

The next gap is pre-mutation precision. Approval says mutation may proceed, but maintainers still need a local, reviewable dry-run contract that states which playbook contract is targeted, which file paths are in scope, whether fixtures are expected to refresh, and which side effects remain forbidden.

## Design

Add:

```bash
npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>
```

The dry-run JSON will include:

- `dryRunId`;
- `approvalPath`;
- `migrationPlanPath`;
- `owner`;
- `createdAt`;
- `mutationType: "registered_playbook_contract_update"`;
- `targetPlaybookId`;
- `plannedTargets`;
- `fixtureImpact`;
- `executionBoundary`.

The gate will:

- require `--dry-run <path>`;
- support `--now <iso-or-date>`, `--current-commit <commit>`, and `--compact`;
- read one local dry-run JSON file;
- re-run the existing mutation approval checker using `approvalPath`;
- re-run the existing migration plan checker using `migrationPlanPath`;
- fail closed unless both referenced reports are green;
- fail closed unless `targetPlaybookId` matches the migration plan target playbook;
- require at least one `plannedTargets` entry for `registered_playbook_contract`;
- require planned target paths to be relative and scoped to `src/lib/executor/playbooks/`;
- require `fixtureImpact.expectedFixtureIds` to cover the migration plan fixture review ids;
- require `executionBoundary` to preserve `dryRunOnly: true`, no mutation, no fixture refresh, no store writes, no external writes, no publishing, and no production readiness.

Status mapping:

- `dry_run_ready`: referenced approval and migration plan are green, targets are scoped, and boundaries are intact;
- `approval_not_green`: referenced mutation approval is not green;
- `migration_plan_not_green`: referenced migration plan is not green;
- `dry_run_not_valid`: dry-run shape, target, fixture impact, or boundary is invalid.

## Boundaries

No migration execution, no registered playbook mutation, no fixture refresh, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This gate only validates a proposed dry-run contract. It does not perform the mutation and does not grant runtime permissions by itself.

# Playbook Lifecycle Mutation Executor Boundary Plan

Date: 2026-07-07

## Objective

Implement a conservative local mutation executor with manifest-based preview and explicit apply confirmation.

## Steps

1. Add failing tests for preview, stale hash rejection, target scope rejection, apply confirmation, and confirmed temp-fixture writes.
2. Add `src/lib/executor/playbooks/lifecycle-mutation-executor.ts`.
3. Add `scripts/playbooks/run-playbook-lifecycle-mutation-executor.mjs`.
4. Add npm scripts:
   - `playbook:lifecycle:mutation:executor:preview`
   - `playbook:lifecycle:mutation:executor:apply`
5. Add a tracked example manifest under `docs/playbook-lifecycle-mutation-manifests/`.
6. Include executor tests in `test:controlled-runtime`.
7. Update README, changelog, next steps, framework, design-goal status, development manual, and memory log.
8. Verify targeted tests, example preview, controlled runtime, core workflows, lint, build, and diff check.

## Acceptance Criteria

- Preview succeeds for a green manifest and does not mutate the target file.
- Preview/apply reject stale `expectedCurrentSha256`.
- Preview/apply reject paths outside `src/lib/executor/playbooks/`.
- Preview/apply reject scoped paths not declared by the approved dry-run target set.
- Apply refuses without `--confirm-apply`.
- Confirmed apply writes only scoped local target files.
- Reports preserve `productionReady: false`, `publishingPerformed: false`, `storeWritesPerformed: false`, and `externalWritesPerformed: false`.

## Residual Risks

- This is still a local file replacement executor, not a production release system.
- Fixture refresh, runtime replay, authoring UI, and external connector writes remain separate future phases.

# Playbook Lifecycle Mutation Post-Apply Sequence Plan

Date: 2026-07-07

## Objective

Add a read-only post-apply sequence contract after lifecycle mutation executor apply.

## Steps

1. Add failing library and CLI tests.
2. Implement `validatePlaybookLifecycleMutationPostApplySequence()`.
3. Add `scripts/playbooks/check-playbook-lifecycle-mutation-post-apply-sequence.mjs`.
4. Add `playbook:lifecycle:mutation:post-apply:sequence:check`.
5. Add tracked example apply-report and post-apply sequence JSON fixtures.
6. Include coverage in `test:controlled-runtime`.
7. Update docs, changelog, next steps, framework, design goal status, development manual, documentation index, and memory.
8. Verify targeted tests, tracked example command, controlled runtime, core workflows, lint, build, and diff check.

## Acceptance Criteria

- Green apply reports are accepted only when they represent completed local apply mode with mutation performed and no fixture/store/external/publishing/production side effects.
- Preview or non-green executor reports fail closed.
- Required post-apply audit commands must appear in exact order.
- Fixture refresh, publishing, and production-ready claims remain blocked by explicit policy fields.
- The checker remains read-only and sequence-only.

## Residual Risks

- This phase declares the required audit order but does not prove those commands were executed.
- Fixture refresh handoff, rollback evidence, post-apply evidence validation, real replay, external connector writes, and production operations remain future phases.

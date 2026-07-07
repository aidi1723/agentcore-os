# Playbook Lifecycle Mutation Candidate Fixture Review Design

Date: 2026-07-07

## Goal

Define a local read-only review gate for an already-built governed trace fixture candidate after fixture refresh handoff and before any committed fixture replacement.

The gate makes candidate acceptance explicit. It validates the candidate fixture contract, replay compatibility, sensitive-marker review, target fixture identity, and non-production boundary without generating candidates or replacing committed fixture JSON.

## Scope

- Add a candidate fixture review checker.
- Read one local review JSON file.
- Read the referenced fixture refresh handoff JSON and reuse the handoff checker.
- Read the referenced candidate fixture JSON file.
- Optionally read the referenced committed fixture JSON file for target-path identity context.
- Validate the candidate with `validateControlledTraceFixture()` and `replayControlledTraceFixture()`.
- Require the review `catalogFixtureId` to be listed in the handoff `intendedFixtureIds`.
- Require the candidate `playbookId` to match the handoff target playbook.
- Require review evidence for source identity, redaction, playbook contract, approval terminal state, writeback identity, failure triage, sensitive string search, replacement diff, catalog gate, runtime regression, and rollback notes.
- Require boundary fields proving no committed fixture replacement, no fixture refresh, no store writes, no external writes, no publishing, and no production readiness.

## Non-Goals

- Build a candidate fixture from a governed trace artifact.
- Write a candidate fixture file.
- Replace committed fixture JSON.
- Mutate the fixture catalog.
- Run catalog, replay, test, lint, or build commands.
- Write stores or business assets.
- Call external connectors.
- Publish, tag, upload, or package artifacts.
- Claim production readiness.

## Review Contract

The review JSON is a maintainer declaration that points at files already present on disk:

- `handoffPath`: the green fixture refresh handoff report source.
- `catalogFixtureId`: the intended committed fixture catalog id, such as `sales-pipeline-governed`.
- `candidateFixturePath`: the local candidate fixture JSON to review.
- `committedFixturePath`: the intended committed fixture JSON path for replacement context.
- `targetPlaybookId`: the playbook the candidate must cover.
- `reviewEvidence`: pass/fail declarations for manual review gates.
- `reviewBoundary`: non-production, no-replacement, no-write boundary.

The checker may inspect the candidate JSON and committed fixture JSON, but it must not write either file.

## Next Gate

After this review gate is green, the next phase can define a committed fixture replacement handoff gate. That future gate should still require explicit human replacement and post-replacement catalog/runtime regression evidence before release handoff.

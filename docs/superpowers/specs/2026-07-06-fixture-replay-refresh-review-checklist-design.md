# Fixture Replay Refresh Review Checklist Design

## Problem

The governed fixture refresh workflow already explains how to build a candidate
fixture from a governed trace artifact and how to verify the committed catalog
after replacement. The candidate review step is still a loose bullet list.

That leaves a maintenance gap: two maintainers could inspect the same generated
fixture differently before replacing a committed fixture. Phase 10q added a
failure fixture matrix for interpreting validation, replay drift, summary, and
harness failures. Phase 10r should connect that matrix to a stricter candidate
review checklist so fixture refresh remains manual but repeatable.

## Goals

- Turn `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md` candidate review into a
  concrete pass/fail checklist.
- Split the review into source identity, redaction, playbook metadata,
  approval state, writeback identity, failure triage, and command gates.
- Cross-link the checklist to the replay contract failure fixture matrix.
- Make rejection conditions explicit so unsafe or incomplete candidates are not
  hand-edited into shape.
- Align `CHANGELOG.md`, `docs/NEXT_STEPS.md`, and the controlled runtime manual
  with the new refresh review path.

## Non-Goals

- Do not add fixture refresh automation.
- Do not add or refresh committed fixture JSON files.
- Do not add runtime/API/UI behavior.
- Do not change `trace:fixture:build`, replay, validation, summary, or harness
  implementation.
- Do not introduce LLM/tool replay, runtime store reads/writes, asset writes, or
  automatic fixture discovery.

## Source Inventory

- Refresh guide:
  `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Replay contract and failure fixture matrix:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md#6-failure-fixture-matrix`
- Fixture builder command:
  `scripts/trace-fixtures/build-fixture.mjs`
- Catalog report command:
  `scripts/trace-fixtures/catalog-report.mjs`
- Summary command:
  `scripts/trace-fixtures/catalog-summary.mjs`
- Failure harness:
  `scripts/trace-fixtures/catalog-failure-harness.mjs`
- Existing verification command set:
  `npm run trace:fixtures --silent`,
  `npm run trace:fixtures:summary --silent`,
  `npm run test:controlled-runtime`,
  `npm run test:core-workflows`,
  `npm run lint`,
  `npm run build`,
  `git diff --check`.

## Documentation Contract

`docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md` should gain a structured
`Candidate Review Checklist` section before manual replacement. The checklist
must include:

- source identity checks;
- redaction checks;
- playbook and plan metadata checks;
- approval and terminal-state checks;
- writeback identity checks;
- failure triage checks that point to the failure fixture matrix;
- replacement diff checks;
- command gate checks.

Each subsection should clearly state pass and reject conditions. Reject
conditions must direct maintainers back to the governed artifact source or
playbook contract instead of hand-editing generated fixture JSON.

## Acceptance Criteria

- A maintainer can follow one checklist from candidate fixture generation to
  replacement decision.
- The checklist makes it clear that failing validation/redaction/stable metadata
  checks block replacement.
- The checklist links to the Phase 10q failure fixture matrix for interpreting
  failed replay report output.
- The guide still preserves manual replacement and no-side-effect replay
  boundaries.
- Project records point the next phase beyond checklist documentation.
- Final verification passes for fixture replay, controlled runtime, core
  workflows, lint, build, and whitespace checks.

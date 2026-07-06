# Fixture Replay Contract Documentation Design

## Context

Phase 10k expanded pure governed trace fixture replay with deeper golden invariants. The replay runner now checks base fixture validation, registered playbook contracts, step order, plan metadata, approval state, completed attempts, and stable writeback identity metadata.

The maintainer refresh guide explains how to build and manually review a candidate fixture, but it does not yet explain the full replay contract matrix. When `npm run trace:fixtures --silent` fails, maintainers need a compact reference that maps each diagnostic/error category to:

- what field is checked;
- which source of truth it is compared against;
- what the failure usually means;
- whether to update the playbook, refresh the fixture, or inspect the governed artifact source.

## Goal

Document the fixture replay contract matrix so maintainers can interpret replay failures consistently without reading `trace-replay.ts`.

## Non-Goals

- No runtime behavior change.
- No test fixture mutation.
- No new CLI command.
- No API route or Runtime Console change.
- No automatic fixture discovery or refresh.
- No LLM replay, tool replay, runtime store mutation, or asset writes.
- No broad documentation rewrite outside the controlled trace fixture workflow.

## Source Inventory

The documentation should be grounded in these current source files:

- `src/lib/executor/runtime/trace-fixtures.ts`: fixture shape and base validation.
- `src/lib/executor/runtime/trace-replay.ts`: replay report, diagnostics, and invariant checks.
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`: expected errors and diagnostic behavior.
- `src/__tests__/fixtures/controlled-traces/catalog-report.ts`: catalog aggregation behavior.
- `scripts/trace-fixtures/catalog-report.mjs`: local JSON summary output.
- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`: manual refresh workflow.
- `docs/NEXT_STEPS.md`: current engineering backlog.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: framework status.
- `docs/DOCUMENTATION_INDEX.zh-CN.md`: documentation entry point.

## Proposed Output

Create:

- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`

The document should be concise and operational. It should include:

1. Purpose and hard boundary.
2. Source-of-truth hierarchy:
   - fixture validation for schema/redaction/self-consistency;
   - playbook catalog for current plan/step/writeback/approval contracts;
   - committed fixture metadata for historical governed trace evidence.
3. Replay invariant matrix covering:
   - fixture schema and required identity fields;
   - redaction boundary;
   - known playbook registration;
   - playbook version and scenario;
   - step order and plan step order;
   - plan id / totalSteps / requiresApproval;
   - approval state presence;
   - approval terminal state;
   - required writeback targets;
   - stable writeback metadata;
   - completed step attempts;
   - no-side-effect guarantees.
4. Diagnostics field reference:
   - `expectedStepOrder`;
   - `fixtureStepOrder`;
   - `missingApprovalStepIds`;
   - `missingWritebackTargets`;
   - `expectedPlaybookVersion`;
   - `fixturePlaybookVersion`;
   - `expectedScenarioId`;
   - `fixtureScenarioId`;
   - `expectedPlanId`;
   - `fixturePlanId`;
   - `expectedPlanTotalSteps`;
   - `fixturePlanTotalSteps`;
   - `expectedPlanRequiresApproval`;
   - `fixturePlanRequiresApproval`;
   - `planStepOrder`;
   - `missingCompletedStepAttempts`;
   - `nonApprovedApprovalStepIds`;
   - `writebackTargetsMissingStableMetadata`.
5. Failure triage:
   - playbook drift;
   - stale fixture;
   - bad governed artifact source;
   - unsafe candidate fixture.
6. Maintainer command sequence:
   - `npm run trace:fixtures --silent`;
   - inspect `failedItems[].replayErrors`;
   - inspect `failedItems[].diagnostics`;
   - use the refresh guide only when the current playbook contract is correct;
   - run `npm run test:controlled-runtime` after fixture changes.

## Link Updates

Update:

- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`: link the new contract guide before the candidate review checklist and in the failure section.
- `docs/DOCUMENTATION_INDEX.zh-CN.md`: list the new guide next to the refresh workflow.
- `docs/NEXT_STEPS.md`: mark Phase 10l completed and set the next conservative phase.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: add Phase 10l to the completed status and update the next phase.
- `CHANGELOG.md`: add an Unreleased entry.
- `memory/2026-07-06.md`: record the phase locally.

## Next Recommended Phase

After 10l, the next conservative phase should be:

**Phase 10m. Fixture Replay Error Summary CLI**

Suggested scope:

- Keep `trace:fixtures` as the machine-readable JSON command.
- Add a separate local command that prints a human-readable failure summary from the same catalog report.
- Do not discover fixtures automatically, refresh fixtures, call routes, replay tools, mutate stores, or write assets.

## Success Criteria

- The new replay contract guide exists and is linked from the refresh guide and documentation index.
- The guide maps current replay checks to source of truth, diagnostics, and maintainer action.
- Current docs point to Phase 10m as the next recommended phase.
- `npm run trace:fixtures --silent` remains green.
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, `npm run build`, and `git diff --check` pass with only the existing lint/build warning if it appears.

## Design Review

This phase intentionally documents the existing contract instead of adding more enforcement. The replay runner is now strict enough that the next bottleneck is maintainer interpretation, not code capability.

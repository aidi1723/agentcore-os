# Fixture Replay Catalog Expansion Review Design

## Problem

The governed trace fixture catalog now contains committed coverage for both
registered controlled playbooks:

- `sales-pipeline-governed` for `sales-pipeline-v1`;
- `support-resolution-governed` for `support-resolution-v1`.

Replay, summary, failure harness, refresh workflow, candidate checklist, and CI
gate documentation are already in place. The remaining risk is catalog growth
without a decision framework. Adding more fixture JSON can improve drift
coverage, but it can also create maintenance noise if every edge case becomes a
committed governed fixture.

Maintainers need one source that answers:

- what the current committed catalog covers;
- which coverage dimensions are intentionally represented by synthetic failure
  fixtures instead of committed governed fixtures;
- when a new committed governed fixture is justified;
- what the next phase should be if no immediate fixture gap is found.

## Goals

- Review the committed governed fixture catalog by playbook, terminal state,
  approval behavior, writeback target family, stable metadata, and edge-case
  trace coverage.
- Add a maintainer-facing catalog coverage guide with a clear expansion decision
  rule.
- Cross-link the coverage guide from replay contract, CI gate documentation,
  documentation index, Next Steps, and controlled runtime manual.
- Keep this phase documentation-first unless the review finds a high-value
  missing committed fixture.
- Preserve the current explicit catalog model. No automatic fixture discovery.

## Non-Goals

- Do not add new fixture JSON unless the review identifies a concrete gap that
  cannot be represented by existing synthetic failure coverage.
- Do not add code paths, API routes, UI changes, runtime store reads/writes,
  LLM/tool replay, or asset writes.
- Do not promote synthetic failure fixtures into the committed governed catalog.
- Do not change `trace:fixtures`, `trace:fixtures:summary`, or
  `trace:fixture:build`.
- Do not add CI configuration.

## Source Inventory

- Committed fixture catalog:
  `src/__tests__/fixtures/controlled-traces/catalog.ts`
- Sales fixture:
  `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`
- Support fixture:
  `src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json`
- Current playbook catalog:
  `src/lib/executor/playbooks/catalog.ts`
- Sales playbook:
  `src/lib/executor/playbooks/sales-pipeline.ts`
- Support playbook:
  `src/lib/executor/playbooks/support-resolution.ts`
- Catalog replay tests:
  `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- Replay contract:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Refresh workflow:
  `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- CI gates:
  `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- Project records:
  `CHANGELOG.md`,
  `docs/NEXT_STEPS.md`,
  `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`,
  `docs/DOCUMENTATION_INDEX.zh-CN.md`.

## Review Findings

Current committed governed fixture coverage is sufficient for the current
registered playbook catalog:

- every registered playbook has one committed successful governed fixture;
- both fixtures end in `terminalState: "completed"`;
- both cover two approval-gated steps with `approvalState: "approved"`;
- both preserve redacted step input, redacted step output, and redacted tool
  output metadata;
- sales covers `sales_asset`, `knowledge_asset`, `draft`, and `workflow_run`
  target families;
- support covers `support_asset`, `knowledge_asset`, `draft`, and
  `workflow_run` target families;
- successful writeback targets include stable `assetId`, `sourceKey`, and
  `workflowRunId` metadata.

Known edge cases are already represented by synthetic failure fixtures and
replay diagnostics rather than committed governed fixtures:

- missing source run id;
- unredacted step input;
- unredacted tool output;
- playbook version drift;
- missing stable writeback metadata;
- step-order drift;
- summary and exit-code failure behavior.

The review does not justify adding another committed fixture in this phase.
The next valuable catalog expansion should be triggered by a new playbook, a
new terminal-state family that becomes a stable replay contract, or a new
writeback target family that cannot be proven by the existing sales/support
fixtures.

## Documentation Contract

Create `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`.

The guide must include:

- purpose and hard boundaries;
- committed catalog source of truth;
- coverage matrix by fixture id, playbook id, scenario, terminal state,
  approval behavior, writeback target families, stable metadata, and decision;
- explicit gap review for terminal states, approval behaviors, writeback target
  families, and edge-case traces;
- expansion decision rules;
- next-phase recommendation.

The guide must be clear that:

- one successful fixture per registered playbook is the current baseline;
- synthetic failures remain test-only diagnostic coverage;
- rejected/failed/awaiting terminal states should not become committed fixtures
  until replay has a stable product-level contract for those states;
- committed fixture expansion should be tied to durable contract coverage, not
  scenario variety.

## Acceptance Criteria

- The new guide explains why the current two committed fixtures are enough for
  the current catalog.
- The guide lists concrete triggers for adding a new committed governed
  fixture.
- Replay contract and CI gate docs link to the coverage guide.
- Documentation index includes the coverage guide.
- Next Steps and the controlled runtime manual record Phase 10t and identify
  the next phase.
- No fixture JSON or runtime code changes are made unless a real coverage gap
  is discovered during implementation.
- Verification runs the fixture replay gates, controlled runtime tests, core
  workflow tests, lint, build, and whitespace check.

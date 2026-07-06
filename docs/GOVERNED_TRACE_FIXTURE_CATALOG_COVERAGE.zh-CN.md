# Governed Trace Fixture Catalog Coverage

Last updated: 2026-07-06

## 1. Purpose

This guide records what the committed governed trace fixture catalog currently covers and when maintainers should add another committed fixture.

Use it with:

- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
- [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)

## 2. Hard Boundaries

Catalog coverage review is a maintenance decision layer only:

- no LLM replay;
- no tool execution;
- no API route calls;
- no runtime store reads or writes;
- no asset writes;
- no automatic fixture discovery;
- no automatic fixture refresh;
- no promotion of synthetic failure fixtures into the committed catalog.

## 3. Current Catalog Source Of Truth

Committed governed fixtures are explicitly listed in `src/__tests__/fixtures/controlled-traces/catalog.ts`.

Current entries:

| Catalog id | Fixture file | Playbook | Scenario | Terminal state | Decision |
| --- | --- | --- | --- | --- | --- |
| `sales-pipeline-governed` | `sales-pipeline-governed.fixture.json` | `sales-pipeline-v1` | `sales-pipeline` | `completed` | Keep as the sales happy-path contract fixture. |
| `support-resolution-governed` | `support-resolution-governed.fixture.json` | `support-resolution-v1` | `support-ops` | `completed` | Keep as the support happy-path contract fixture. |

## 4. Coverage Matrix

| Dimension | Current coverage | Evidence | Gap decision |
| --- | --- | --- | --- |
| Registered playbooks | Both current playbooks have one committed fixture. | `sales-pipeline-v1`, `support-resolution-v1` | No new fixture until a new playbook is registered. |
| Terminal state | Both committed fixtures are `completed`. | Fixture `terminalState` fields | Do not add rejected/failed/awaiting fixtures until replay defines stable terminal-state contracts for them. |
| Approval behavior | Both fixtures include approved `human_review` and `writeback` approval gates. | `approvalState: "approved"` on approval-gated steps | Rejection and pending approval remain runtime behavior tests, not committed governed fixtures yet. |
| Writeback target families | Sales covers `sales_asset`, `knowledge_asset`, `draft`, `workflow_run`; support covers `support_asset`, `knowledge_asset`, `draft`, `workflow_run`. | Fixture `writebackTargets` | Add a fixture only when a new durable target family appears and is not covered by sales/support. |
| Stable metadata | Successful writeback targets carry `assetId`, `sourceKey`, and `workflowRunId`. | Fixture writeback target metadata | Missing metadata is covered by synthetic failure fixtures, not another committed happy-path fixture. |
| Redaction boundary | Both fixtures mark step input/output and tool output redacted. | `hasRedactedInput`, `hasRedactedOutput`, `outputRedacted` | Unsafe candidates are rejected through refresh review. |
| Edge-case drift | Version drift, missing metadata, missing source id, unredacted input/output, summary failure, and exit-code failure are covered synthetically. | `synthetic-failures.ts` and catalog tests | Keep edge cases synthetic unless they become durable product examples. |

## 5. When To Add A Committed Fixture

Add a new committed governed fixture only when at least one condition is true:

- a new registered controlled playbook needs baseline replay coverage;
- a new durable writeback target family cannot be represented by existing sales/support fixtures;
- replay grows a stable terminal-state contract for failed, rejected, or awaiting states;
- a real governed artifact reveals a contract gap that synthetic failure fixtures cannot represent;
- the fixture will become a long-lived compatibility contract, not a one-off scenario sample.

Do not add a committed fixture for:

- minor copy or content variation;
- another example of the same completed approval path;
- raw failure examples that are better represented by synthetic failure factories;
- temporary local debugging artifacts;
- candidate fixtures that need manual redaction or manual receipt edits.

## 6. Current Decision

No new committed fixture is needed in Phase 10t.

The current catalog already covers every registered playbook, the primary completed terminal state, approval-approved paths, all current writeback target families, redaction metadata, and stable record identity metadata.

The next recommended phase should move from fixture catalog maintenance to trace governance operationalization, such as real replay boundaries, governed artifact lifecycle policy, or operator-facing trace governance runbooks.

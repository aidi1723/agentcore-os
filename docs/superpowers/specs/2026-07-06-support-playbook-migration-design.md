# Support Playbook Migration Design

## Goal

Migrate `support-ops` into the second controlled playbook, `support-resolution-v1`, so the controlled runtime proves it can execute more than the sales pipeline.

This phase should produce a working, tested support controlled run that:

- resolves from the existing `support-ops` scenario,
- validates against the same controlled playbook contract as sales,
- executes a fixed support step sequence,
- writes durable workflow, draft, support asset, and knowledge asset records,
- appears in Runtime Console through the existing controlled run summary and landing model.

## Current Context

The sales path already has:

- `sales-pipeline-v1` in `src/lib/executor/playbooks/sales-pipeline.ts`,
- catalog lookup in `src/lib/executor/playbooks/catalog.ts`,
- deterministic plan conversion in `src/lib/executor/playbooks/resolver.ts`,
- playbook / plan validation in `src/lib/executor/playbooks/validator.ts`,
- controlled writeback in `src/lib/executor/runtime/writeback.ts`,
- Runtime Console summaries in `src/lib/executor/runtime/console-summary.ts`.

Support already has:

- scenario id `support-ops` in `src/lib/workspace-presets.ts`,
- support workflow helpers in `src/lib/support-workflow.ts`,
- support tickets in `src/lib/support.ts`,
- support assets in `src/lib/support-assets.ts`,
- server-backed support asset storage in `src/lib/server/support-asset-store.ts`,
- Support Copilot UI and existing support asset workflows.

The gap is that support is still an app-level workflow, not a controlled playbook.

## Design

### Playbook

Add `src/lib/executor/playbooks/support-resolution.ts` exporting `supportResolutionPlaybook`.

The playbook id is `support-resolution-v1`, scenario id is `support-ops`, version is `1.0.0`, and the fixed step order is:

1. `intake`
   - Mode: `assist`
   - Purpose: normalize customer issue context.
   - Writes: `workflow_run` on success.
2. `classify`
   - Mode: `assist`
   - Purpose: classify issue type, priority, risk, and missing fields.
   - Writes: `support_asset` on success.
3. `draft_reply`
   - Mode: `assist`
   - Purpose: generate a reply draft for human review.
   - Writes: `draft` on success.
4. `human_review`
   - Mode: `review`
   - Purpose: confirm factual accuracy, tone, escalation boundary, and next action.
   - Requires approval.
   - Writes: `workflow_run` after approval.
5. `writeback`
   - Mode: `manual`
   - Purpose: write approved support outcome into durable assets.
   - Requires approval.
   - Writes: `support_asset`, `knowledge_asset`, and `workflow_run` after approval.

The playbook should use only existing tools:

- `llm_generate` for assist steps,
- `knowledge_search` where support context lookup is relevant,
- `human_ask` for review/manual steps.

### Catalog And Resolver

Register the support playbook in `src/lib/executor/playbooks/catalog.ts`.

No resolver change should be necessary if the playbook follows the existing `ControlledPlaybook` contract. Tests should prove:

- `getControlledPlaybook("support-resolution-v1")` returns the support playbook,
- `getControlledPlaybookForScenario("support-ops")` returns the support playbook,
- `resolveExecutionPlanFromPlaybook(supportResolutionPlaybook)` returns the five fixed steps.

### Writeback

Extend `writeControlledStepAssets` to handle `support_asset`.

Support writeback should be idempotent by stable support asset id:

```text
controlled-support-asset:{workflowRunId}
```

Support asset fields should be derived from controlled step outputs:

- `intake.normalizedIssue.customer` -> `customer`
- `intake.normalizedIssue.channel` -> `channel`
- `intake.summary` / `normalizedIssue.issue` -> `issueSummary`
- `classify.priority`, `classify.category`, `classify.risks` -> `latestDigest`
- `draft_reply.body` or `human_review.approvedReply` -> `latestReply`
- `human_review.nextAction` / `classify.nextAction` -> `nextAction`
- `writeback.faqCandidate` -> `faqDraft`

Status mapping:

- `classify` support asset receipt -> `replying`
- final approved `writeback` receipt -> `completed`

Knowledge writeback must support support playbooks without breaking sales:

- sales keeps `assetType: "sales_playbook"`,
- support uses `assetType: "support_faq"`,
- support source key remains `controlled-run:{run.id}:knowledge_asset`,
- support tags include `controlled-run`, `support-ops`, and `support-resolution-v1`.

Draft and workflow writeback can reuse existing helpers if they derive labels/scenario from the playbook and run rather than hard-coding sales-specific text.

### Runtime Console

Do not add a new Runtime Console panel in this phase.

The existing summary should work for:

- workflow run landings,
- draft landings,
- knowledge asset landings.

Add `support_asset` to the console landing model only if support writeback receipts need an explicit landing entry. The first version should map it to Support Copilot:

```text
support_asset -> support_copilot
```

If the open action is not implemented in this phase, the summary should still expose the landing metadata and search fields so a follow-up phase can wire record focus. The preferred first slice is summary/search metadata, not new UI behavior.

### Tests

Add focused tests before implementation:

- support playbook definition and deterministic resolver test,
- catalog lookup by id and scenario,
- writeback unit test for support asset output and idempotency,
- controlled runtime integration test for support execution and durable writes,
- console summary test for support asset landing/search if `support_asset` is added to landings.

`test:controlled-runtime` should include the support playbook test and support writeback/runtime coverage after the slice is complete.

## Non-Goals

This phase does not:

- redesign Support Copilot UI,
- add support-specific Runtime Console panels,
- implement record-level open/focus from Runtime Console to Support Copilot,
- change the sales playbook step sequence,
- introduce new tools,
- create a generic playbook builder UI.

## Success Criteria

- `support-resolution-v1` validates with the existing controlled playbook validator.
- The resolver builds a deterministic five-step support execution plan.
- A support controlled run executes without invoking planner fallback when a controlled plan is supplied.
- Durable run trace records support step outputs, approval states, schema validation, and writeback receipts.
- Approved final support writeback creates one support asset, one knowledge asset, and a completed workflow run.
- Repeat writeback for the same run does not create duplicate support or knowledge assets.
- Existing sales controlled runtime tests remain green.

## Risks And Constraints

- `writeback.ts` currently contains sales-specific builder names and some sales labels. The implementation should add support-specific builders while keeping sales behavior unchanged.
- `knowledge_asset` writeback currently assumes sales field names. Support output parsing must branch by playbook/scenario.
- Runtime Console `appId` type currently excludes Support Copilot. If `support_asset` becomes a landing, the app id union must widen carefully and tests should prove existing sales/knowledge/workflow/draft landings still work.
- Support Copilot already has app-level asset creation. Controlled writeback must be idempotent by workflow run id to avoid duplicate support assets.

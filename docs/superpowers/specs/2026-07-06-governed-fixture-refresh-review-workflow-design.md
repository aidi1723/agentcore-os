# Governed Fixture Refresh Review Workflow Design

## Context

Phase 10i added a local builder command:

```bash
npm run trace:fixture:build -- <artifact.json>
```

The command can convert one governed trace artifact JSON file into validated fixture JSON on stdout. The remaining gap is operational: maintainers still need a clear, repeatable review path for deciding when and how to replace a committed fixture.

This phase documents the refresh workflow only. It does not add an auto-write command, filesystem discovery, runtime store reads, route calls, tool replay, or asset writes.

## Goals

- Add a maintainer-facing guide for refreshing governed trace fixtures.
- Define the exact sequence:
  1. export or obtain a governed trace artifact;
  2. save it to a local temporary file;
  3. run `npm run trace:fixture:build -- <artifact.json>`;
  4. inspect the generated fixture JSON;
  5. manually replace the intended committed fixture file;
  6. run catalog and controlled runtime gates;
  7. document the fixture refresh in the change record.
- Make review checks explicit: redaction boundary, fixture id/source run id, playbook id/version, step order, approval state, schema flags, writeback targets, and absence of raw customer/secret payloads.
- Link the guide from the controlled runtime manual, documentation index, and next steps.
- Update changelog and memory records.

## Non-Goals

- No API route.
- No Runtime Console or UI change.
- No automatic committed fixture writeback.
- No filesystem discovery of artifact or fixture files.
- No real LLM/tool replay.
- No runtime store reads or writes.
- No asset writeback.
- No fixture catalog mutation script.
- No new npm command beyond the existing builder and catalog commands.

## Proposed Design

Create:

`docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`

The guide should contain:

- purpose and scope;
- prerequisites;
- source artifact boundary;
- command recipe;
- manual replacement steps;
- review checklist;
- verification gates;
- failure handling;
- explicit actions that remain forbidden.

Recommended command recipe:

```bash
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
npm run trace:fixtures --silent
npm run test:controlled-runtime
```

The guide should explain that redirection is a maintainer action outside the builder command. The builder itself only writes stdout.

Update:

- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - add the guide link;
  - mark Phase 10j as completed;
  - keep the next phase focused on future real replay or deeper fixture guarantees.
- `docs/NEXT_STEPS.md`
  - add the guide to the completed baseline;
  - convert the Phase 10j recommended next section to completed;
  - set the next recommended phase to a conservative future slice.
- `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - add the guide under engineering/runtime documents.
- `CHANGELOG.md`
  - record the guide and the continued pure boundary.
- `memory/2026-07-06.md`
  - record the phase and verification.

## Review Checklist Contents

The guide must instruct maintainers to inspect generated fixture JSON before replacing any committed fixture:

- `schemaVersion` is `controlled-trace-fixture/v1`;
- `playbookId` and `playbookVersion` match the intended playbook;
- `assertions.stepOrder` matches the current playbook step order;
- each `requiresApproval` step has `approvalState`;
- writeback targets match the playbook contract for the same step;
- `hasRedactedInput`, `hasRedactedOutput`, and tool `outputRedacted` are true;
- serialized fixture does not contain known raw customer names, secrets, emails, API keys, prompt text, or tool output payloads;
- the fixture replacement is manually reviewed in git diff.

## Acceptance Criteria

- A maintainer can follow one document to refresh a governed fixture without inferring hidden steps.
- The guide clearly separates builder stdout from manual fixture file replacement.
- The guide includes exact verification commands.
- Project docs link to the guide from the controlled runtime manual and documentation index.
- No runtime behavior changes are introduced.
- Existing catalog summary, controlled runtime, core workflow, lint, build, and diff checks pass.

# Design Goal Completion And Playbook Control Audit Design

## Goal

Record the current design-goal completion status and add a local read-only playbook control-chain audit so registered controlled playbooks cannot silently drift away from the runtime contract.

## Current Problem

AgentCore OS has the core Controlled Skill / Playbook Runtime pieces in place, but the design goal is not fully complete. Existing checks are spread across playbook validators, fixture replay, delivery gates, and release handoff evidence. Maintainers need one focused gate that answers: "Are registered playbooks complete enough for controlled execution?"

A concrete current gap is that a playbook may write to targets that are not declared in `resultAssets`. That weakens precision because the runtime can write records that the playbook contract does not advertise.

## Approach

Add a read-only audit helper and CLI:

```bash
npm run playbook:control:audit
```

The audit will inspect registered controlled playbooks and committed governed fixture catalog metadata. It will not run tools, mutate stores, write assets, generate traces, refresh fixtures, publish releases, or claim production readiness.

## Audit Coverage

The audit checks:

- catalog uniqueness for playbook ids and scenario ids;
- base playbook identity fields;
- step id uniqueness and non-empty ordered steps;
- input/output object schemas and required output fields;
- tool allowlist and declared toolCalls consistency through the existing validator;
- approval gates for `review` / `manual` and `after_approval` writes;
- failure policy shape;
- writeback target declarations against `resultAssets`;
- at least one committed governed fixture per registered playbook;
- fixture catalog uniqueness and no-side-effect replay coverage via the existing catalog report.

## Report Shape

The CLI prints machine-readable JSON:

- `ok`;
- `command`;
- `productionReady: false`;
- `publishingPerformed: false`;
- `auditOnly: true`;
- `summary`;
- `items`;
- `findings`;
- `nextCommand`;
- `nextAction`.

It exits `0` only when all registered playbooks pass the control audit and fixture replay coverage is green.

## Boundaries

No UI change, no new playbook, no real replay, no external connector, no release publication, no local evidence mutation.

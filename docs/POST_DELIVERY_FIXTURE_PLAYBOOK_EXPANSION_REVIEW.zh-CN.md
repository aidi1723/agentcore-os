# Post-Delivery Fixture And Playbook Expansion Review

Last updated: 2026-07-06

## 1. Decision

Current decision: **do not add a new committed fixture or migrate a new controlled playbook immediately after delivery smoke.**

Reason:

- registered playbooks are already covered by committed governed fixtures;
- delivery demo data is local seed/check data, not a governed trace fixture source;
- browser smoke did not reveal a new playbook contract gap;
- real replay remains out of scope.

## 2. Current Coverage

| Area | Current state | Decision |
| --- | --- | --- |
| Registered playbooks | `sales-pipeline-v1`, `support-resolution-v1` | Covered |
| Committed governed fixtures | `sales-pipeline-governed`, `support-resolution-governed` | Covered |
| Delivery demo runs | completed, awaiting approval, retryable failed | Keep as local demo data, not fixtures |
| Writeback target families | sales, support, knowledge, workflow, draft | Covered by sales/support fixture families |
| Real replay | Not implemented | Keep blocked behind replay boundary |

## 3. Coverage Guard

The governed fixture catalog test now asserts:

- every registered controlled playbook has exactly one committed governed fixture entry;
- fixture catalog entries do not point at unregistered playbooks.

Focused gate:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

## 4. Expansion Rules

Add a new fixture only when a new durable contract appears:

- a new registered playbook;
- a new durable writeback target family;
- a stable replay terminal-state contract for failed/rejected/awaiting runs;
- a real governed artifact exposes a contract gap not covered by synthetic failures.

Add a new controlled playbook only after:

- a business scenario is selected;
- spec and plan are approved;
- TDD coverage exists;
- governed trace / replay gates stay green;
- writeback and approval boundaries are explicit.

Do not add fixtures or playbooks just because the local delivery demo contains more example records.

## 5. Next Direction

Recommended next phase: **Trace Operations Hardening**.

Focus:

- retention and artifact handoff discipline;
- release checklist alignment;
- fixture refresh stop conditions;
- browser evidence repeatability;
- no real replay or new playbook until a separate spec justifies it.

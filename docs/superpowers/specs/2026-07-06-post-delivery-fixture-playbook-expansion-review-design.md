# Post-Delivery Fixture And Playbook Expansion Review Design

## Status

Approved design for the post-delivery review after Delivery Demo Smoke Path and Browser Evidence And Release Readiness Sweep.

## Context

The project now has:

- two registered controlled playbooks: `sales-pipeline-v1` and `support-resolution-v1`;
- two committed governed fixtures: `sales-pipeline-governed` and `support-resolution-governed`;
- command-level delivery demo seed/check scripts;
- browser smoke evidence for Home -> Runtime Console -> `delivery-demo-run-completed` -> asset landings -> governed trace copy.

An earlier fixture catalog coverage review already decided that no extra committed fixture JSON was needed while sales/support cover all registered playbooks and current writeback target families. This phase should not repeat that work. It should turn the post-delivery question into a guarded decision:

**Did delivery evidence reveal a real reason to add a fixture or migrate another playbook?**

## Goal

Add a small post-delivery review gate that proves every currently registered controlled playbook has committed governed fixture coverage, records that the delivery demo does not require new fixture/playbook expansion, and sets the next work direction conservatively.

## Non-Goals

- Do not add new fixture JSON.
- Do not add a new controlled playbook.
- Do not implement real LLM/tool replay.
- Do not call API routes or mutate runtime stores from tests.
- Do not redesign Runtime Console.
- Do not promote delivery demo seed data into committed governed fixtures.

## Design

### 1. Coverage Regression

Add a focused test to the governed fixture catalog suite:

- read `listControlledPlaybooks()`;
- read `controlledTraceFixtureCatalog`;
- assert every registered playbook id appears exactly once in the committed fixture catalog;
- assert no catalog entry points at an unregistered playbook.

This protects future maintainers from adding a playbook without a governed fixture review.

### 2. Review Document

Add `docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md` with:

- current registered playbook matrix;
- current committed fixture matrix;
- delivery demo impact analysis;
- expansion decision;
- allowed next directions.

The expected decision is:

- no new fixture JSON now;
- no new playbook migration now;
- next best work is operational hardening or a focused spec if a real new business playbook is chosen later.

### 3. Project Record Alignment

Update:

- `docs/NEXT_STEPS.md`;
- `docs/ROADMAP.md`;
- `docs/PROJECT_FRAMEWORK.zh-CN.md`;
- `docs/DOCUMENTATION_INDEX.zh-CN.md`;
- `CHANGELOG.md`;
- this phase plan.

The docs should no longer imply that fixture/playbook expansion is automatically next. They should say the review must happen first and current decision is no expansion.

## Verification

Required:

```bash
git diff --check
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
npm run trace:fixtures --silent
npm run replay:sandbox:fixtures --silent
npm run test:controlled-runtime
```

Optional full delivery gate:

```bash
npm run delivery:demo:check
npm run test:core-workflows
npm run lint
npm run build
```

Known accepted warning:

- `npm run lint` and `npm run build` may show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Acceptance Criteria

- A failing test exists before implementation for playbook/fixture coverage completeness.
- The test passes after implementation.
- The review document states a clear expansion decision.
- Project records point away from automatic expansion.
- No fixture JSON, playbook code, runtime route, or external side effect is added.

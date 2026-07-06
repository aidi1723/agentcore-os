# Trace Governance Operational Runbook Design

## Problem

Trace governance now has the technical building blocks:

- governed trace artifact builder and local route;
- Runtime Console governed trace copy action;
- conservative terminal-run prune helper;
- governed fixture builder CLI;
- committed fixture replay, summary, refresh workflow, CI gate guidance, failure matrix, and catalog coverage review.

These pieces are documented individually, but maintainers do not yet have one
operational runbook that explains the end-to-end lifecycle:

1. export a governed trace artifact;
2. decide whether it should become a fixture candidate;
3. build and review a candidate fixture;
4. run catalog replay gates;
5. triage failures;
6. apply retention safely;
7. understand where metadata replay stops and future real replay begins.

Without a runbook, maintainers can follow the right command in the wrong order,
refresh fixtures for the wrong reason, or confuse no-side-effect metadata replay
with production replay.

## Goals

- Add one maintainer-facing operational runbook for governed trace lifecycle work.
- Document the approved lifecycle from artifact export through fixture refresh,
  replay gates, retention, and handoff.
- Clarify hard boundaries between:
  - governed artifact export;
  - committed fixture replay;
  - future real tool replay;
  - production execution.
- Define failure escalation paths for unsafe artifacts, stale fixtures,
  playbook drift, CI gate failures, and retention questions.
- Cross-link the runbook from the fixture refresh workflow, CI gate guide,
  documentation index, Next Steps, and controlled runtime manual.
- Keep the phase documentation/operations-first unless the runbook exposes a
  real missing command or unsafe gap.

## Non-Goals

- Do not add or change API routes.
- Do not change Runtime Console UI.
- Do not add fixture JSON.
- Do not change fixture replay, summary, builder, or retention code.
- Do not add CI configuration.
- Do not implement real LLM/tool replay.
- Do not add automated artifact discovery or automatic fixture refresh.
- Do not make legal/privacy promises beyond describing current product
  behavior and maintainer review boundaries.

## Source Inventory

- Governed artifact builder:
  `src/lib/executor/runtime/trace-governance.ts`
- Governed artifact route:
  `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`
- Runtime Console copy action:
  `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- Retention helper:
  `src/lib/server/controlled-execution-store.ts`
- Fixture builder CLI:
  `scripts/trace-fixtures/build-fixture.mjs`
- Catalog report CLI:
  `scripts/trace-fixtures/catalog-report.mjs`
- Catalog summary CLI:
  `scripts/trace-fixtures/catalog-summary.mjs`
- Refresh workflow:
  `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Replay contract:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- CI gates:
  `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- Catalog coverage guide:
  `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`
- Documentation index:
  `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Project records:
  `CHANGELOG.md`,
  `docs/NEXT_STEPS.md`,
  `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`.

## Design

Create `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`.

The runbook should use a staged lifecycle:

1. **Export governed artifact**
   - Source: Runtime Console `复制脱敏 Trace` or the local
     `trace-artifact` route.
   - Boundary: exported payload is `{ export, artifact }`; maintainers must not
     use raw controlled run records as fixture sources.

2. **Classify artifact intent**
   - Audit only: retain/export for local investigation.
   - Candidate fixture: only when playbook drift or catalog coverage rules
     justify fixture refresh.
   - Reject: if redaction, identity, approval, or writeback metadata is unsafe.

3. **Build fixture candidate**
   - Command:
     `npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json`
   - Boundary: builder writes stdout only; maintainer controls redirection and
     committed replacement.

4. **Review candidate**
   - Delegate detailed checklist to
     `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`.
   - Run sensitive string search and replacement diff review before commit.

5. **Run catalog gates**
   - Human triage:
     `npm run trace:fixtures:summary --silent`
   - Machine gate:
     `npm run trace:fixtures --silent`
   - Runtime gate:
     `npm run test:controlled-runtime`

6. **Handle failure escalation**
   - Validation failure: reject candidate or fix governed artifact source.
   - Replay drift: confirm playbook contract before refreshing.
   - Missing stable writeback metadata: fix receipt source or re-export.
   - Harness or summary mismatch: keep it in tests; do not alter committed
     fixtures to satisfy harness behavior.

7. **Retention and cleanup**
   - Document that `pruneControlledExecutionRuns()` keeps active and
     approval-blocked runs while pruning old terminal runs according to policy.
   - State that retention policy should not delete runs needed for an active
     refresh/review until artifact export is complete.

8. **Real replay boundary**
   - Current replay is metadata compatibility only.
   - Future real replay must be a separate design with explicit tool, store,
     approval, credential, and side-effect controls.

## Compliance And Wording Review

The runbook is an internal maintainer document. It must avoid:

- claiming legal compliance;
- promising permanent deletion;
- promising complete privacy guarantees;
- implying that redacted artifacts are safe for unrestricted external sharing.

It may state current technical behavior:

- raw step input/output, tool output, approval feedback, audit messages,
  run/step errors, and free-form plan text are redacted by the governed artifact
  builder;
- fixture replay does not execute tools, call routes, read/write stores, or
  write assets.

## Acceptance Criteria

- The runbook gives maintainers a single ordered lifecycle for governed trace
  artifact work.
- The runbook links to existing detailed docs instead of duplicating every
  checklist.
- The runbook names exact commands and explains their role.
- The runbook includes failure escalation and stop conditions.
- The runbook explicitly separates metadata replay from future real replay.
- Existing fixture refresh, CI gate, documentation index, Next Steps, and
  controlled runtime manual link to the runbook.
- No runtime code, fixture JSON, or package command changes are made unless a
  concrete gap is discovered during implementation.
- Verification runs fixture replay gates, controlled runtime tests, core
  workflow tests, lint, build, and whitespace checks.

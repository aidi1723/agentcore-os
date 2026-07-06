# Fixture Replay CI Gate Documentation Design

## Problem

Governed trace fixture replay now has:

- `npm run trace:fixtures --silent` for machine-readable JSON catalog health;
- `npm run trace:fixtures:summary --silent` for human-readable local triage;
- a replay contract guide for interpreting failures;
- a refresh workflow and candidate review checklist for manual fixture updates.

The remaining gap is operational documentation. Maintainers need one concise
reference that says which command belongs in local checks, fixture refresh
reviews, and CI-style gates, and which output is stable enough for automation.

## Goals

- Add a dedicated CI/local gate guide for governed trace fixture replay.
- Define the difference between the JSON command and human-readable summary
  command.
- Document local development, fixture refresh, and CI-style gate sequences.
- State the no-side-effect guarantees and what green replay does not prove.
- Cross-link the guide from the replay contract, refresh guide, documentation
  index, Next Steps, and controlled runtime manual.
- Keep this phase docs-only unless review exposes a real missing command.

## Non-Goals

- Do not add GitHub Actions, CI configuration, or package scripts.
- Do not change `trace:fixtures`, `trace:fixtures:summary`, or
  `trace:fixture:build`.
- Do not refresh fixture JSON files.
- Do not change replay validation, summary formatting, or failure harness code.
- Do not add LLM/tool replay, runtime store reads/writes, API calls, or asset
  writes.

## Source Inventory

- Package commands:
  `package.json`
- JSON catalog report:
  `scripts/trace-fixtures/catalog-report.mjs`
- Human summary command:
  `scripts/trace-fixtures/catalog-summary.mjs`
- Replay contract:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Refresh workflow:
  `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Documentation index:
  `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Project records:
  `CHANGELOG.md`,
  `docs/NEXT_STEPS.md`,
  `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`.

## Documentation Contract

Create `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`.

The guide must include:

- purpose and scope;
- command roles:
  - `trace:fixtures` is stable machine-readable JSON for automation;
  - `trace:fixtures:summary` is local human triage over the same report;
- local development gate;
- fixture refresh gate;
- CI-style gate;
- failure interpretation path;
- output stability contract;
- hard boundaries and no-side-effect guarantees.

The guide must not imply that summary output is a stable automation API. It
must point automation at JSON output and humans at summary output.

## Acceptance Criteria

- Maintainers can decide which fixture replay command to use in each context.
- CI-style guidance says JSON command failure blocks the gate.
- Human summary guidance says summary output is advisory/triage, not an
  automation contract.
- Refresh workflow links to the CI gate guide.
- Replay contract links to the CI gate guide.
- Documentation index includes the new guide.
- Next Steps and the controlled runtime manual mark Phase 10s complete and move
  the next phase beyond CI gate documentation.
- Full verification passes for fixture replay, controlled runtime, core
  workflows, lint, build, and whitespace checks.

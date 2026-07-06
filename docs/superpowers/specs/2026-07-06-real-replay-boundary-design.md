# Real Replay Boundary Design

## Context

AgentCore OS now has governed trace artifacts, governed fixtures, fixture
replay, fixture catalog reports, refresh guidance, CI-style fixture gates, and
an operational trace runbook.

Current replay is intentionally metadata-only. It validates committed governed
fixture metadata against the current controlled playbook contracts. It does not
call LLMs, execute tools, call API routes, read or write runtime stores, or
write business assets.

The next risk is premature "real replay" implementation. Without a written
boundary, future work could accidentally replay tools against production
credentials, mutate stores, create assets, or treat redacted governed artifacts
as sufficient input for business-output replay.

## Goal

Define the boundary for any future real replay work before adding runtime code.

This phase should produce a maintainer-facing real replay boundary guide and
align the existing framework docs around it. The guide should explain what real
replay may consume, what it may simulate, what it must never touch, how replay
results are owned, and what stop conditions block prototype work.

## Non-Goals

- Do not implement real replay.
- Do not replay LLM output.
- Do not execute tools or tool simulators.
- Do not call API routes.
- Do not read or write runtime stores.
- Do not write sales, support, knowledge, workflow, draft, or other business
  assets.
- Do not add package scripts.
- Do not add fixture JSON.
- Do not change Runtime Console behavior.
- Do not make legal, privacy, or compliance promises beyond current technical
  boundaries.

## Source Inventory

- Project framework:
  `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Roadmap:
  `docs/ROADMAP.md`
- Current backlog:
  `docs/NEXT_STEPS.md`
- Controlled runtime manual:
  `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Governed trace operational runbook:
  `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- Fixture replay contract:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Fixture CI gates:
  `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- Current metadata replay implementation:
  `src/lib/executor/runtime/trace-replay.ts`
- Governed fixture builder and validator:
  `src/lib/executor/runtime/trace-fixtures.ts`
- Governed trace artifact builder:
  `src/lib/executor/runtime/trace-governance.ts`

## Design Options

### Option A. Document The Boundary Only

Add one real replay boundary guide and align project records. This makes the
next implementation phase clear without adding a partial abstraction that might
be mistaken for a safe replay engine.

Trade-off: no executable guard exists yet.

### Option B. Add Contract Types Now

Define TypeScript interfaces for replay sandbox, credentials, stores, approvals,
and result artifacts while writing the guide.

Trade-off: types can look like implementation permission before the operational
boundary is reviewed.

### Option C. Prototype No-Side-Effect Replay Immediately

Build a minimal sandbox prototype now.

Trade-off: this skips the current roadmap gate and risks unclear side-effect
ownership.

## Chosen Approach

Use Option A for Phase 10v.

This phase should be documentation and governance only. TypeScript contract
types belong in the next phase after the boundary guide is accepted.

## Boundary Model

Future real replay must be treated as a separate execution mode, not an
extension of fixture replay.

The boundary guide should define these surfaces:

1. **Replay input source**
   - Allowed: governed trace artifacts and committed governed fixtures.
   - Required provenance: source run id, playbook id/version, scenario id,
     generated/exported timestamp, fixture id when applicable.
   - Stop condition: raw controlled run records, unredacted payloads, unknown
     playbook ids, stale playbook versions without explicit review, or missing
     source identity.

2. **Replay sandbox ownership**
   - A future replay sandbox owns all replay-local state.
   - The controlled runtime store, approval store, app stores, and asset stores
     remain outside the sandbox.
   - Stop condition: any replay path needs production store mutation to finish.

3. **Credential isolation**
   - No production credential is available to replay by default.
   - Future tool replay must use explicit fake, fixture, or replay-scoped
     credentials.
   - Stop condition: a replay step requires a live API key, bearer token,
     connector credential, user session, or production account.

4. **Approval simulation**
   - Approval states are replay inputs or replay-local simulated decisions.
   - Simulation cannot create durable approvals or bypass the real approval
     state machine in production.
   - Stop condition: replay needs a live operator approval to mutate business
     state.

5. **Store isolation**
   - Replay may read from replay fixtures or sandbox snapshots only.
   - Replay result artifacts are separate from runtime stores.
   - Stop condition: replay reads or writes `controlled-runs`, workflow runs,
     draft stores, support assets, sales assets, or knowledge assets directly.

6. **Side-effect blocking**
   - Default future prototype mode is no-side-effect.
   - Disallowed side effects include tool calls, API routes, connector calls,
     file writes outside replay artifacts, business asset writes, notifications,
     emails, webhooks, and durable approval/store mutations.
   - Stop condition: side effects cannot be enumerated and blocked before
     replay starts.

7. **Replay result ownership**
   - Replay output belongs to a replay result artifact, not business assets.
   - Result artifacts should record replay mode, source provenance, simulated
     approvals, sandbox ids, blocked side-effect attempts, diagnostics, and
     verification guarantees.
   - Stop condition: output would be indistinguishable from a real controlled
     run or approved asset writeback.

8. **Artifact and fixture provenance**
   - Every replay result must point back to its governed artifact or fixture.
   - Redacted fields stay redacted; replay cannot invent missing raw payloads.
   - Stop condition: a replay requires raw text that governance deliberately
     removed.

## Guide Structure

Create `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md` with:

1. purpose and current status;
2. current metadata-only replay boundary;
3. future real replay threat model;
4. allowed inputs;
5. sandbox ownership;
6. credential isolation;
7. approval simulation;
8. store isolation;
9. side-effect blocking;
10. replay result artifact ownership;
11. stop conditions;
12. verification gates;
13. next implementation phases.

## Documentation Alignment

Update these documents to point to the new guide:

- `docs/DOCUMENTATION_INDEX.zh-CN.md`
- `docs/NEXT_STEPS.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/ROADMAP.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- `CHANGELOG.md`

`docs/NEXT_STEPS.md` should move Phase 10v from recommended next to completed
after the guide is written. The next recommended phase should be:

**Replay Sandbox Contract Types**

That phase may introduce TypeScript-only contracts for a future no-side-effect
prototype, but still should not execute tools or mutate stores.

## Acceptance Criteria

- A maintainer can read one guide and understand why current replay remains
  metadata-only.
- The guide names the replay sandbox owner, credential boundary, approval
  simulation boundary, store boundary, side-effect boundary, and replay result
  owner.
- The guide includes explicit stop conditions that block unsafe replay inputs or
  unsafe implementation attempts.
- Existing roadmap/framework/runbook documents link to the guide.
- No runtime code, package scripts, fixture JSON, Runtime Console UI, or store
  behavior changes in this phase.
- Verification covers whitespace checks and governed fixture gates.

## Verification

Minimum verification:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Preferred verification:

```bash
npm run test:controlled-runtime
```

Known accepted warning for broader gates:

- `npm run lint` and `npm run build` may show the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`.

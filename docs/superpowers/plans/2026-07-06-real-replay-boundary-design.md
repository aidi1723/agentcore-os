# Real Replay Boundary Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainer-facing real replay boundary guide and align the project records so no real replay code starts before sandbox, credential, approval, store, side-effect, and result ownership boundaries are explicit.

**Architecture:** This is a documentation/governance phase. The new guide becomes the single boundary reference; framework, roadmap, runbook, backlog, manual, and changelog link to it and keep the next implementation phase limited to replay sandbox contract types.

**Tech Stack:** Markdown documentation, existing governed trace and fixture replay commands, existing controlled runtime test scripts.

---

## File Structure

- Create `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`: the canonical real replay boundary guide.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`: add the new guide to the suggested reading order and internal engineering section.
- Modify `docs/NEXT_STEPS.md`: mark Phase 10v completed and set the next recommended phase to Replay Sandbox Contract Types.
- Modify `docs/PROJECT_FRAMEWORK.zh-CN.md`: replace "boundary not designed" wording with a pointer to the new guide and keep implementation blocked until the next contract phase.
- Modify `docs/ROADMAP.md`: mark P0 design output as this guide and clarify that P1 starts with contract types before a prototype.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: add Phase 10v to the progress snapshot and keep real replay code out of scope.
- Modify `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`: link its real replay boundary section to the new guide.
- Modify `CHANGELOG.md`: record the Phase 10v documentation/governance change.

---

### Task 1: Add The Canonical Boundary Guide

**Files:**
- Create: `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`

- [ ] **Step 1: Write the guide**

Create the guide with these sections:

```markdown
# Real Replay Boundary Design

Last updated: 2026-07-06

## 1. Purpose

This guide defines the boundary for future real replay work in AgentCore OS.

Current governed fixture replay is metadata-only. It validates committed governed fixture metadata against controlled playbook contracts. It does not replay LLM output, execute tools, call API routes, read or write runtime stores, or write business assets.

Real replay must not start as code until sandbox ownership, credential isolation, approval simulation, store isolation, side-effect blocking, replay result ownership, provenance, stop conditions, and verification gates are explicit.

## 2. Current Status

Implemented today:

- governed trace artifact export;
- governed fixture generation and validation;
- committed sales/support governed fixtures;
- pure metadata fixture replay;
- fixture catalog report and human-readable summary;
- fixture refresh workflow, replay contract, CI gates, catalog coverage guide, and operational runbook.

Not implemented today:

- LLM replay;
- tool replay;
- tool simulation;
- API route replay;
- store snapshot replay;
- business asset replay;
- production replay.

## 3. Threat Model

Real replay is unsafe if it can:

- access production credentials;
- call live connectors, APIs, routes, webhooks, email, or notification systems;
- mutate controlled run, approval, workflow, draft, sales, support, or knowledge stores;
- create business assets;
- turn redacted governed artifacts back into invented raw content;
- bypass the production approval state machine;
- produce output that looks like an approved controlled run.

## 4. Allowed Replay Inputs

Allowed inputs:

- governed trace artifacts produced by the trace artifact route or Runtime Console governed trace copy action;
- committed governed fixtures listed in the explicit fixture catalog;
- future reviewed replay sandbox snapshots.

Required provenance:

- source run id;
- playbook id and version;
- scenario id;
- generated or exported timestamp;
- fixture id when replaying a committed fixture;
- governance mode;
- redaction flags.

Stop if the input is a raw controlled run record, has unredacted payloads, lacks source identity, references an unknown playbook, or requires raw text that governance removed.

## 5. Replay Sandbox Ownership

A future replay sandbox owns replay-local state only.

The sandbox may own:

- replay session id;
- replay-local step state;
- replay-local simulated approvals;
- replay-local blocked side-effect log;
- replay result artifact.

The sandbox does not own:

- controlled execution store;
- approval store;
- workflow run store;
- draft store;
- sales asset store;
- support asset store;
- knowledge asset store;
- Runtime Console operational state.

Stop if replay requires production store mutation to finish.

## 6. Credential Isolation

Replay has no production credentials by default.

Allowed credential classes:

- fake credentials for contract tests;
- fixture credentials that cannot reach external systems;
- replay-scoped credentials created only for a sandbox.

Disallowed credential classes:

- live API keys;
- bearer tokens;
- connector credentials;
- user sessions;
- production account credentials.

Stop if any replay step requires a live credential or hidden ambient session.

## 7. Approval Simulation

Approvals in replay are simulated or fixture-derived.

Replay may:

- read approval state from governed artifacts or fixtures;
- create replay-local simulated approval decisions;
- record whether a production approval would have been required.

Replay must not:

- create durable approval records;
- mark production approvals approved or rejected;
- bypass approval gates in production;
- ask an operator to approve a business mutation from replay.

Stop if replay needs live approval to mutate business state.

## 8. Store Isolation

Replay may read only replay inputs and replay sandbox snapshots.

Replay must not read or write:

- controlled run store;
- approval store;
- workflow run store;
- draft store;
- sales asset store;
- support asset store;
- knowledge asset store.

Replay result artifacts are separate from runtime stores.

Stop if replay requires direct runtime store access.

## 9. Side-Effect Blocking

The default future prototype mode is no-side-effect.

Disallowed side effects:

- LLM calls;
- tool execution;
- API route calls;
- connector calls;
- webhooks;
- email or notification sends;
- file writes outside replay artifacts;
- store mutations;
- business asset writes;
- durable approval mutations.

Stop if the side effects for a replay path cannot be enumerated and blocked before replay starts.

## 10. Replay Result Artifact Ownership

Replay output belongs to a replay result artifact, not business assets.

A replay result artifact should record:

- replay id;
- replay mode;
- source artifact or fixture provenance;
- playbook id and version;
- scenario id;
- sandbox id;
- simulated approval decisions;
- blocked side-effect attempts;
- diagnostics;
- no-side-effect guarantees;
- generated timestamp.

Stop if output would be indistinguishable from a real controlled run, approved writeback receipt, or business asset.

## 11. Verification Gates

Before changing real replay boundaries, run:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Before adding replay contract types or prototypes, also run:

```bash
npm run test:controlled-runtime
```

## 12. Next Phase

The next allowed phase is Replay Sandbox Contract Types.

That phase may define TypeScript-only contracts for replay inputs, sandbox context, credential policy, approval simulation, store isolation, side-effect blocking, and replay result artifacts.

It still must not replay LLM output, execute tools, call API routes, mutate stores, or write assets.
```

- [ ] **Step 2: Review the guide for scope drift**

Run:

```bash
rg -n "execute tools|call API routes|write assets|production credentials|Stop if|must not" docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md
```

Expected: matches are boundary/stop-condition language, not implementation instructions.

- [ ] **Step 3: Commit the guide**

```bash
git add docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md
git diff --check --cached
git commit -m "docs: define real replay boundary"
```

---

### Task 2: Align Entry Docs And Backlog

**Files:**
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add documentation index links**

Add `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md` to the suggested reading order after the governed trace operational runbook and to the internal engineering section.

- [ ] **Step 2: Update Next Steps**

In `docs/NEXT_STEPS.md`, replace the recommended Phase 10v section with:

```markdown
## Completed. Real Replay Boundary Design

Why:

- Current governed fixture replay is metadata-only and must remain no-side-effect.
- Future real replay needed an explicit sandbox, credential, approval, store, side-effect, provenance, and result ownership boundary before code starts.

Delivered:

- Added `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`.
- Defined allowed replay inputs and required provenance.
- Defined replay sandbox ownership, credential isolation, approval simulation, store isolation, side-effect blocking, and replay result artifact ownership.
- Added stop conditions for unsafe replay input, live credentials, production store access, business asset writes, unblocked side effects, and output that could be confused with real controlled runs.

Outcome:

- Future work can move to replay sandbox contract types without implementing real replay prematurely.

## Recommended Next. Replay Sandbox Contract Types

Suggested scope:

- Add TypeScript-only contracts for replay input, sandbox context, credential policy, approval simulation, store isolation, side-effect policy, and replay result artifacts.
- Keep the phase no-side-effect: no LLM replay, no tool execution, no route calls, no store reads/writes, and no asset writes.
- Add tests proving the contracts reject live credentials, production store access, and business asset write targets.
```

- [ ] **Step 3: Update framework and roadmap**

Change "real replay boundary not designed" wording to "boundary documented in `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`" while preserving the rule that implementation has not started.

- [ ] **Step 4: Update manual and runbook**

Add Phase 10v to the controlled runtime progress snapshot and link the runbook real replay boundary section to the new guide.

- [ ] **Step 5: Update changelog**

Add an Unreleased bullet:

```markdown
- Added a real replay boundary guide covering replay input provenance, sandbox ownership, credential isolation, approval simulation, store isolation, side-effect blocking, replay result ownership, and stop conditions before any real replay implementation.
```

- [ ] **Step 6: Commit aligned docs**

```bash
git add docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md CHANGELOG.md
git diff --check --cached
git commit -m "docs: align real replay boundary docs"
```

---

### Task 3: Verify And Record The Phase

**Files:**
- Modify: `docs/superpowers/plans/2026-07-06-real-replay-boundary-design.md`
- Modify: `memory/2026-07-06.md` only if local memory tracking is desired; do not commit local memory unless explicitly requested.

- [ ] **Step 1: Run required verification**

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

- `git diff --check` exits `0`;
- `trace:fixtures` exits `0` and reports `ok: true`;
- `trace:fixtures:summary` exits `0` and reports `Status: OK`.

- [ ] **Step 2: Run preferred controlled runtime gate**

```bash
npm run test:controlled-runtime
```

Expected: existing controlled runtime tests pass. Current known baseline is 30 files / 166 tests.

- [ ] **Step 3: Mark plan checkboxes**

Update this plan file so completed steps use `- [x]`.

- [ ] **Step 4: Commit the completed plan record**

```bash
git add docs/superpowers/plans/2026-07-06-real-replay-boundary-design.md
git diff --check --cached
git commit -m "docs: complete real replay boundary plan"
```

---

## Self-Review Checklist

- Spec coverage: guide creation, entry doc alignment, backlog transition, verification, and commit boundaries are covered.
- Scope boundary: no runtime code, package scripts, fixture JSON, store behavior, API route, or Runtime Console UI changes.
- Placeholder scan: this plan contains no `TBD`, `TODO`, or deferred content placeholders.
- Next phase: Replay Sandbox Contract Types is named explicitly and remains no-side-effect.

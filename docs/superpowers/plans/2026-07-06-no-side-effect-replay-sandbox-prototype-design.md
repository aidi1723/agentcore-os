# No-Side-Effect Replay Sandbox Prototype Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the maintainer-facing design guide for the future no-side-effect replay sandbox prototype and align project records around the next implementation phase.

**Architecture:** This is a documentation/design phase. It creates a canonical guide for a future `replay-sandbox.ts` module, but does not implement runtime code, execute replay, call routes, read/write stores, or write assets.

**Tech Stack:** Markdown documentation, existing replay sandbox contracts, existing governed fixture replay commands, existing controlled runtime tests.

---

## File Structure

- Create `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
  - Canonical design guide for the future no-side-effect prototype.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Add the guide to recommended reading and internal engineering docs.
- Modify `docs/NEXT_STEPS.md`
  - Mark Phase 10x completed and set next recommended phase to No-Side-Effect Replay Sandbox Prototype Implementation.
- Modify `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - Mark prototype design completed and keep implementation side-effect-free.
- Modify `docs/ROADMAP.md`
  - Point P2 to the guide and keep P3 as implementation.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add Phase 10x to the progress snapshot.
- Modify `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
  - Link the prototype design guide from the next phase section.
- Modify `CHANGELOG.md`
  - Record the Phase 10x design work.

---

### Task 1: Add The Prototype Design Guide

**Files:**
- Create: `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`

- [x] **Step 1: Write the guide**

Create `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`:

```markdown
# No-Side-Effect Replay Sandbox Prototype Design

Last updated: 2026-07-06

## 1. Purpose

This guide defines the smallest future no-side-effect replay sandbox prototype.

The prototype must consume only a validated `ReplaySandboxContract` and emit only a replay result artifact. It must not replay LLM output, execute tools, call API routes, read or write runtime stores, write business assets, or change Runtime Console behavior.

## 2. Current Preconditions

Already completed:

- real replay boundary guide;
- replay sandbox contract types;
- `validateReplaySandboxContract()`;
- `buildNoSideEffectReplayResultArtifact()`;
- no-side-effect contract tests in `test:controlled-runtime`.

Still not implemented:

- replay sandbox prototype;
- LLM replay;
- tool replay;
- API route replay;
- store snapshot replay;
- business asset replay.

## 3. Future Module Boundary

Future implementation should create:

```text
src/lib/executor/runtime/replay-sandbox.ts
```

The module should export:

```ts
runNoSideEffectReplaySandbox(contract: ReplaySandboxContract): ReplayResultArtifact
```

The prototype must stay separate from `trace-replay.ts`. Metadata fixture replay remains a playbook/fixture compatibility gate. The sandbox prototype is a replay-local artifact generator.

## 4. Input Contract

The prototype accepts only `ReplaySandboxContract`.

It rejects direct use of:

- raw controlled run records;
- governed trace artifacts;
- governed fixtures;
- workflow run ids;
- asset ids;
- route request objects;
- runtime store handles.

Callers must create a contract before invoking the prototype.

## 5. Preflight

The first operation is always:

```ts
const validation = validateReplaySandboxContract(contract);
```

If validation fails, the prototype returns a failure replay result artifact.

Failure artifact behavior:

- no cursor advancement beyond `preflight`;
- validation errors become diagnostics;
- no approval simulation beyond contract-provided data;
- no side-effect attempts;
- no thrown error for ordinary unsafe contract input.

## 6. Replay-Local State

The prototype may own:

- replay id;
- sandbox id;
- cursor events;
- source provenance;
- simulated approvals;
- blocked side effects;
- diagnostics;
- replay result artifact.

The prototype must not own or reference:

- controlled execution store;
- approval store;
- workflow run store;
- draft store;
- sales asset store;
- support asset store;
- knowledge asset store;
- Runtime Console state.

## 7. Cursor Events

The first prototype should use replay-local cursor events:

- `preflight`;
- `load_source_metadata`;
- `simulate_approvals`;
- `block_side_effects`;
- `emit_result_artifact`.

It must not claim that playbook business steps were re-executed.

## 8. Approval Simulation

Approval simulation is metadata-only.

Allowed:

- copy contract simulated decisions into the artifact;
- record that production approval would have been required;
- add diagnostics for missing simulated approval decisions.

Disallowed:

- durable approval writes;
- approval API calls;
- live operator approval prompts;
- production approval state mutation.

## 9. Side-Effect Blocking

Side effects are blocked before execution, not after attempted execution.

The prototype should derive blocked side effects from contract policy and result artifact fields. It must not call a tool, route, connector, webhook, email, notification, file writer, store writer, or asset writer to prove blocking.

## 10. Result Artifact

The only output is a replay result artifact.

The artifact should include:

- schema version;
- replay id;
- sandbox id;
- source provenance;
- replay mode;
- status;
- cursor events;
- simulated approvals;
- blocked side effects;
- diagnostics;
- no-side-effect guarantees.

The artifact must not be shaped like a controlled run, writeback receipt, workflow run, draft, or business asset.

## 11. Implementation Stop Conditions

Stop implementation if the plan requires:

- LLM replay;
- tool execution;
- route calls;
- runtime store reads;
- runtime store writes;
- business asset writes;
- fixture JSON changes;
- Runtime Console UI changes;
- raw governed artifact payload recovery.

## 12. Next Phase

The next allowed phase is No-Side-Effect Replay Sandbox Prototype Implementation.

That phase may add `replay-sandbox.ts` and tests proving:

- unsafe contracts return failure artifacts before execution;
- safe contracts emit result artifacts only;
- guarantees remain false for tool calls, asset writes, store mutation, and production credentials.
```

- [x] **Step 2: Review guide scope**

Run:

```bash
rg -n "execute tools|route calls|runtime store|business asset|Stop implementation|replay-sandbox.ts|runNoSideEffectReplaySandbox" docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md
```

Expected: matches are design boundaries, not implementation claims.

- [x] **Step 3: Commit the guide**

```bash
git add docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md
git diff --check --cached
git commit -m "docs: design no-side-effect replay sandbox"
```

---

### Task 2: Align Entry Docs

**Files:**
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [x] **Step 1: Update documentation index and README**

Add `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md` to the documentation index and update current-next wording to implementation.

- [x] **Step 2: Update `docs/NEXT_STEPS.md`**

Replace `Recommended Next. No-Side-Effect Replay Sandbox Prototype Design` with:

```markdown
## Completed. No-Side-Effect Replay Sandbox Prototype Design

Why:

- Replay sandbox contracts are now executable, but prototype implementation needed one more design boundary.
- The prototype must stay separate from metadata fixture replay and must output only replay result artifacts.

Delivered:

- Added `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`.
- Defined future `replay-sandbox.ts` module boundary and `runNoSideEffectReplaySandbox()` API shape.
- Required `validateReplaySandboxContract()` as preflight.
- Defined failure artifact behavior for unsafe contracts.
- Defined replay-local state, cursor events, approval simulation, side-effect blocking, and result artifact ownership.
- Preserved stop conditions against LLM replay, tool execution, route calls, runtime store access, and asset writes.

Outcome:

- Future implementation can build the smallest no-side-effect prototype without touching production stores or business assets.

## Recommended Next. No-Side-Effect Replay Sandbox Prototype Implementation

Suggested scope:

- Add `src/lib/executor/runtime/replay-sandbox.ts`.
- Add tests proving unsafe contracts return failure artifacts before execution.
- Add tests proving safe contracts emit replay result artifacts only.
- Keep implementation no-side-effect: no LLM replay, no tool execution, no route calls, no runtime store reads/writes, and no asset writes.
```

- [x] **Step 3: Update framework, roadmap, manual, and boundary guide**

Mark Phase 10x complete and set the next phase to prototype implementation.

- [x] **Step 4: Update changelog**

Add:

```markdown
### No-Side-Effect Replay Sandbox Prototype Design

- Added a no-side-effect replay sandbox prototype design guide covering future module boundaries, preflight validation, replay-local state, cursor events, approval simulation, side-effect blocking, result artifacts, and stop conditions.
```

- [x] **Step 5: Commit aligned docs**

```bash
git add README.md CHANGELOG.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md
git diff --check --cached
git commit -m "docs: align no-side-effect replay sandbox design"
```

---

### Task 3: Final Verification And Plan Record

**Files:**
- Modify: `docs/superpowers/plans/2026-07-06-no-side-effect-replay-sandbox-prototype-design.md`
- Optional local-only: `memory/2026-07-06.md`

- [x] **Step 1: Run verification**

Run:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
```

Expected:

- whitespace check exits 0;
- fixture replay JSON reports `ok: true`;
- fixture summary reports `Status: OK`;
- controlled runtime tests pass.

- [x] **Step 2: Mark plan complete**

Update checkboxes to `- [x]` and add completion notes with exact verification results.

- [x] **Step 3: Commit plan record**

```bash
git add docs/superpowers/plans/2026-07-06-no-side-effect-replay-sandbox-prototype-design.md
git diff --check --cached
git commit -m "docs: complete no-side-effect replay sandbox design plan"
```

---

## Self-Review Checklist

- Spec coverage: source inventory, future module boundary, input contract, preflight, replay-local state, cursor events, approval simulation, side-effect blocking, result artifact, stop conditions, docs, and verification are covered.
- Scope boundary: no runtime code, no tool execution, no route calls, no store reads/writes, no asset writes, no fixture JSON, no UI changes.
- Placeholder scan: this plan contains no deferred placeholders.

## Completion Notes

- Completed on: 2026-07-06
- Commits:
  - `0d28282` - `docs: design no-side-effect replay sandbox`
  - `716d5e3` - `docs: align no-side-effect replay sandbox design`
- Verification:
  - `git diff --check` - exit 0
  - `npm run trace:fixtures --silent` - ok true; 2 total / 2 passed / 0 failed
  - `npm run trace:fixtures:summary --silent` - Status OK
  - `npm run test:controlled-runtime` - 31 files / 170 tests passed
  - `npm run test:core-workflows` - all core workflow regressions passed
- Outcome: Phase 10x is complete. The next allowed phase is Phase 10y No-Side-Effect Replay Sandbox Prototype Implementation.

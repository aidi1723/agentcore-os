# Delivery Candidate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only delivery candidate gate that validates a single candidate report against current controlled-runtime, handoff summary, documentation, and non-production evidence.

**Architecture:** Follow the existing playbook lifecycle checker pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one candidate JSON file, reuses the handoff summary checker and delivery ready checker, and passes parsed reports into the validator. The checker validates recorded evidence and boundary metadata without running full regression/build commands or release actions.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing delivery and playbook lifecycle checker conventions.

---

### Task 1: Delivery Candidate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/delivery-candidate-readiness.ts`
- Create: `scripts/delivery-candidate/check-delivery-candidate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/delivery-candidate-readiness.test.ts`
- Test: `src/__tests__/scripts/delivery-candidate-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/delivery-candidate-readiness.test.ts`

Expected: fail because `src/lib/executor/playbooks/delivery-candidate-readiness.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/delivery-candidate-check-script.test.ts`

Expected: fail because `scripts/delivery-candidate/check-delivery-candidate.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless handoff summary and delivery readiness are green, command evidence is ordered and green, docs are aligned, risk/rollback summaries preserve non-production boundaries, and the delivery candidate boundary remains candidate-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/delivery-candidate-readiness.test.ts src/__tests__/scripts/delivery-candidate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/delivery-candidates/example-local-delivery-candidate.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Add npm script and controlled-runtime coverage**

Add `delivery:candidate:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example candidate report**

The example must reference the tracked handoff summary, summarize green delivery/runtime/core/lint/build/diff evidence, list aligned docs, keep deferred production work explicit, and keep publication/production boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say local delivery candidate hardening is now declared, and the next concrete gap is production release policy/packaging/deployment hardening, still separate from publishing and production readiness.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/delivery-candidate-readiness.test.ts src/__tests__/scripts/delivery-candidate-check-script.test.ts
npm run delivery:candidate:check -- --candidate docs/delivery-candidates/example-local-delivery-candidate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers handoff summary reuse, delivery ready reuse, candidate fields, command evidence, docs, risk summary, rollback summary, side-effect boundaries, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `delivery candidate`, `handoffSummaryPath`, `commandEvidence`, `documentationSummary`, `riskSummary`, `rollbackSummary`, and `deliveryCandidateBoundary` consistently.

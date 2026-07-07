# Artifact Upload Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only artifact upload execution gate after the tag creation execution gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one artifact upload gate JSON file, reuses the tag creation gate checker, and passes parsed reports into the validator. The checker validates artifact upload request metadata, artifact identity review, checksum/provenance policy, command evidence, rollback/monitoring plans, credential boundaries, and gate-only upload boundaries without creating artifacts, checksums, uploads, releases, deployments, credentials, or production-readiness claims.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Artifact Upload Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/artifact-upload-execution-gate.ts`
- Create: `scripts/release-execution/check-artifact-upload-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/artifact-upload-execution-gate.test.ts`
- Test: `src/__tests__/scripts/artifact-upload-gate-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/artifact-upload-execution-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/artifact-upload-execution-gate.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/artifact-upload-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-artifact-upload-gate.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless tag creation gate evidence is green, command evidence is ordered and green, identity fields are valid, artifact request/identity/checksum/provenance metadata is documented, rollback and monitoring sections exist, credentials remain disallowed, artifact upload decision remains blocked, and the boundary remains gate-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/artifact-upload-execution-gate.test.ts src/__tests__/scripts/artifact-upload-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-artifact-upload-gate.json`
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

Add `release:artifact-upload:gate:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example artifact upload gate**

The example must reference the tracked tag creation gate, summarize green tag-gate/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, artifact upload request metadata, artifact identity review, checksum/provenance policy, rollback plan, monitoring plan, credential boundary, artifact upload decision, and gate-only artifact upload boundary.

- [ ] **Step 3: Update documentation**

Update project docs to say artifact upload execution gate review is now declared, and the next concrete gap is deployment execution gate design. Continue to state that artifact creation, checksum creation, artifact upload, release creation, deployment, external writes, credential use, and production readiness claims remain blocked.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/artifact-upload-execution-gate.test.ts src/__tests__/scripts/artifact-upload-gate-check-script.test.ts
npm run release:artifact-upload:gate:check -- --gate docs/release-execution-gates/example-artifact-upload-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers tag creation gate reuse, identity fields, artifact upload request, artifact identity review, checksum/provenance policy, command evidence, rollback/monitoring, credential boundary, gate-only artifact upload boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `artifact upload execution gate`, `tagCreationGatePath`, `artifactUploadRequest`, `artifactIdentityReview`, `checksumProvenancePolicy`, `artifactUploadDecision`, `artifactUploadBoundary`, `gateOnly`, and `artifact_upload_execution_gate_review` consistently.

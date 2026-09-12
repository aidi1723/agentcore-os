# Claw Code Executor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LobsterAI-centered execution base with a claw-code runtime backend while preserving AgentCore OS product ownership.

**Architecture:** AgentCore OS keeps its normalized executor contract, session/audit stores, and UI workflows. A new claw-code adapter becomes the default runtime backend and maps CLI execution into AgentCore result and trace records.

**Tech Stack:** Next.js 15, TypeScript, Node runtime APIs, Tauri desktop shell, Tailwind CSS, local CLI runtime integration.

---

## File Structure

- Create `DESIGN.md`: root UI design contract for future redesign work.
- Create `src/lib/executor/claw-code.ts`: CLI adapter helpers, binary resolution, argument building, output parsing, and execution wrapper.
- Modify `src/lib/executor/contracts.ts`: add `claw_code` to executor trace engine types and optional backend policy fields.
- Modify `src/lib/executor/core.ts`: route execution through claw-code by default when runtime configuration is present; keep direct model execution as fallback.
- Modify `src/lib/server/executor-runner.ts`: persist new engine values without changing session/audit behavior.
- Modify API/runtime UI copy in representative surfaces after the runtime backbone is stable.
- Add tests under `src/lib/executor/__tests__/claw-code.test.ts` if the existing test runner supports colocated tests; otherwise add a lightweight Node regression script.

## Task 1: Root Design Contract

**Files:**
- Create: `DESIGN.md`

- [ ] **Step 1: Add root UI design contract**

Create `DESIGN.md` with stable tokens and component rules based on `docs/AGENTCORE_OS_UI_DESIGN_MASTER_GUIDELINE.zh-CN.md` and `docs/STITCH_UI_REDESIGN_BRIEF.zh-CN.md`.

- [ ] **Step 2: Review for consistency**

Run: `sed -n '1,260p' DESIGN.md`
Expected: the document defines product identity, navigation hierarchy, color roles, typography, density, surfaces, states, and runtime-specific UI rules.

## Task 2: Claw Code Adapter Tests

**Files:**
- Create: `src/lib/executor/claw-code.ts`
- Create: `src/lib/executor/claw-code.test.mjs`

- [ ] **Step 1: Write failing adapter tests**

Test binary resolution, CLI argument construction, stdout parsing, and error mapping without spawning the real claw binary.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: FAIL because `src/lib/executor/claw-code.ts` does not exist or exported helpers are missing.

- [ ] **Step 3: Implement adapter helpers**

Implement focused functions:

- `resolveClawCodeBinary`
- `buildClawCodePrompt`
- `buildClawCodeArgs`
- `parseClawCodeOutput`
- `mapClawCodeFailure`

- [ ] **Step 4: Run adapter tests**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: PASS.

## Task 3: Contract Engine Type

**Files:**
- Modify: `src/lib/executor/contracts.ts`
- Modify: `src/lib/executor/claw-code.test.mjs`

- [ ] **Step 1: Add failing test for trace engine**

Assert that a parsed claw-code success can be represented as an attempt with `engine: "claw_code"`.

- [ ] **Step 2: Run test and confirm failure**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: FAIL until the contract type and adapter output include the new engine.

- [ ] **Step 3: Extend engine unions**

Add `claw_code` to trace attempt and final trace engine unions.

- [ ] **Step 4: Run focused tests**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: PASS.

## Task 4: Runtime Execution Path

**Files:**
- Modify: `src/lib/executor/core.ts`
- Modify: `src/lib/executor/claw-code.ts`

- [ ] **Step 1: Add failing test for runtime selection**

Add a test that proves claw-code is selected when `AGENTCORE_EXECUTOR_BACKEND=claw_code` or equivalent request policy is present.

- [ ] **Step 2: Run failing test**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: FAIL until selection exists.

- [ ] **Step 3: Implement minimal selector**

Add a small backend selector that defaults to `claw_code` when a claw binary is configured, otherwise uses direct model execution.

- [ ] **Step 4: Run focused tests**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: PASS.

## Task 5: Representative UI Copy

**Files:**
- Modify: `src/components/apps/OpenClawConsoleAppWindow.tsx`
- Modify: `src/components/apps/SettingsAppWindow.tsx`
- Modify: `src/lib/desktop-runtime.ts`

- [ ] **Step 1: Identify Lobster/OpenClaw execution labels**

Run: `rg -n "Lobster|lobster|OpenClaw|openclaw|执行器|runtime" src/components src/lib`
Expected: labels and runtime surfaces are listed.

- [ ] **Step 2: Replace representative runtime copy**

Use `Claw Runtime`, `Claw Code 执行底座`, and `AgentCore Executor` where appropriate while preserving route compatibility names.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new lint errors from UI copy changes.

## Task 6: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run adapter tests**

Run: `node src/lib/executor/claw-code.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS or report existing unrelated lint configuration issue explicitly.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.


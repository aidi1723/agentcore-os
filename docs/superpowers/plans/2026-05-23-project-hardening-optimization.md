# Project Hardening Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden request handling, remove duplicated asset route logic, and reduce `src/app/page.tsx` maintenance risk without changing product behavior.

**Architecture:** Keep public API contracts stable. Move shared server concerns into focused helpers, add regression coverage before production changes, and extract page-local pure logic into small client-safe modules.

**Tech Stack:** Next.js App Router, TypeScript, Node.js regression scripts, existing `readJsonBodyWithLimit` guard.

---

### Task 1: API Request Body Guard Coverage

**Files:**
- Modify: `scripts/regression/workflows.mjs`

- [ ] Add regression checks that call selected route `POST` handlers with oversized JSON bodies and non-JSON content types.
- [ ] Verify the new checks fail before production route changes.

### Task 2: API Request Body Guard Implementation

**Files:**
- Modify: `src/app/api/llm/chat/route.ts`
- Modify: `src/app/api/publish/jobs/route.ts`
- Modify: `src/app/api/publish/jobs/[jobId]/route.ts`
- Modify: `src/app/api/runtime/sidecar/route.ts`
- Modify additional direct `req.json()` routes only when they share the same local API risk profile.

- [ ] Replace direct `req.json()` parsing with `readJsonBodyWithLimit`.
- [ ] Return existing response shapes while preserving `413`, `415`, and `400` status codes from `RequestBodyError`.
- [ ] Run targeted regressions.

### Task 3: Asset Route De-duplication

**Files:**
- Create: `src/lib/server/output-asset-route.ts`
- Modify: `src/app/api/openclaw/assets/[name]/route.ts`
- Modify: `src/app/api/runtime/media/assets/[name]/route.ts`

- [ ] Move filename validation, content-type resolution, stat check, read, and response creation into the shared helper.
- [ ] Keep route URLs and response headers unchanged.
- [ ] Run TypeScript and build verification.

### Task 4: `page.tsx` Low-risk Logic Split

**Files:**
- Create: focused helper/hook files under `src/components/home/` or `src/hooks/`
- Modify: `src/app/page.tsx`

- [ ] Extract app-window state transitions into a hook without changing state names.
- [ ] Extract runtime open-app prefill dispatch mapping into a helper.
- [ ] Keep rendered markup and UI class names stable.
- [ ] Run lint, TypeScript, and build.

### Task 5: Final Verification

**Files:**
- No additional production changes expected.

- [ ] Run `npm run lint`.
- [ ] Run `npm run test:core-workflows`.
- [ ] Run `npm run test:publish`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `npm run desktop:smoke-test-sidecar` with escalation if sandbox blocks local listening.

# Engineering Hardening Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make clean-worktree tests and strict TypeScript checks deterministic, then prevent publish webhooks from reaching private networks through DNS or redirects.

**Architecture:** Repair typing at test and script ownership boundaries while preserving the root strict TypeScript scope. Add an asynchronous DNS policy resolver and a Node HTTP(S) webhook transport whose socket lookup is pinned to the validated address, then integrate it behind the existing publish receipt contract.

**Tech Stack:** TypeScript 5.9, Vitest 3, Node.js DNS/HTTP/HTTPS APIs, Next.js 15 App Router, existing publish regression scripts.

---

### Task 1: Deterministic Clean-Worktree Baseline

**Files:**
- Modify: `src/__tests__/scripts/playbook-lifecycle-mutation-preflight-script.test.ts`

- [x] **Step 1: Preserve the clean-worktree failure evidence**

Run:

```bash
npm test -- --silent=passed-only --reporter=dot
```

Expected: one failure in `builds a successful preflight result for the tracked example` because ignored closeout evidence is absent.

- [x] **Step 2: Make the tracked-fixture test inject deterministic upstream gates**

Change the test name and builder call to:

```ts
it("builds a successful preflight result for the tracked dry-run with green upstream gates", () => {
  const result = buildPlaybookLifecycleMutationPreflightCliResult({
    evidencePath,
    dryRunPath,
    now: "2026-07-07T03:00:00Z",
    currentCommit: fullCommit,
    buildCloseoutResult: () => closeoutResult(),
    buildDryRunResult: () => dryRunResult(),
    pretty: false,
  });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    ok: true,
    readyForMutationExecutor: true,
  });
});
```

- [x] **Step 3: Verify the isolated baseline**

Run:

```bash
npx vitest run src/__tests__/scripts/playbook-lifecycle-mutation-preflight-script.test.ts
npm test -- --silent=passed-only --reporter=dot
```

Expected: targeted test passes; 137 files and 695 tests pass.

- [x] **Step 4: Commit**

```bash
git add src/__tests__/scripts/playbook-lifecycle-mutation-preflight-script.test.ts
git commit -m "test: make mutation preflight baseline deterministic"
```

### Task 2: Shared Spawn Result Test Fixture

**Files:**
- Create: `src/__tests__/helpers/spawn-result.ts`
- Modify: `src/__tests__/scripts/delivery-ready-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-snapshot-script.test.ts`

- [x] **Step 1: Confirm the 32 process-result type failures**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: `TS2322` reports that minimal `{ status, stdout, stderr }` mocks do not satisfy `SpawnSyncReturns<string>`.

- [x] **Step 2: Add a structurally complete spawn result builder**

Create:

```ts
import type { SpawnSyncReturns } from "node:child_process";

export function spawnResult({
  status = 0,
  stdout = "",
  stderr = "",
}: {
  status?: number | null;
  stdout?: string;
  stderr?: string;
} = {}): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status,
    signal: null,
  };
}
```

- [x] **Step 3: Replace incomplete process mocks**

Import `spawnResult` in each listed test and replace returns as follows:

```ts
runCheck: () => spawnResult({ status: 0, stdout: "ok\n" })
gitRunner: () => spawnResult({ status: 0, stdout: `${fullCommit}\n` })
handoffRunner: () => spawnResult({ status: 1, stderr: "failed" })
```

Wrap every current `{ status, stdout, stderr }` literal in a call to `spawnResult` without changing those three field values. Preserve the null-status process error as `spawnResult({ status: null, stderr: "spawn failed" })`.

- [x] **Step 4: Narrow optional report fields instead of casting**

Before reading conditional properties in delivery and release handoff tests, add assertions such as:

```ts
expect(result.report).toHaveProperty("failedCheck");
if (!("failedCheck" in result.report)) throw new Error("Expected failed report");

const failed = result.report.checks.find((check) => !check.ok);
expect(failed).toBeDefined();
if (!failed || !("stdoutExcerpt" in failed) || !("stderrExcerpt" in failed)) {
  throw new Error("Expected failed check excerpts");
}
```

- [x] **Step 5: Verify the cluster**

Run:

```bash
npx vitest run src/__tests__/scripts/delivery-ready-check-script.test.ts src/__tests__/scripts/release-handoff-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-snapshot-script.test.ts
npx tsc --noEmit --pretty false
```

Expected: listed tests pass and all `SpawnSyncReturns<string>` assignment errors are removed.

- [x] **Step 6: Commit**

```bash
git add src/__tests__/helpers/spawn-result.ts src/__tests__/scripts/delivery-ready-check-script.test.ts src/__tests__/scripts/release-handoff-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-snapshot-script.test.ts
git commit -m "test: type subprocess fixtures"
```

### Task 3: Executor and Trace Fixture Type Safety

**Files:**
- Modify: `src/__tests__/app/api/agent-stream-route.test.ts`
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- Modify: `src/__tests__/lib/executor/runtime/resume.test.ts`
- Modify: `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`
- Modify: `src/__tests__/lib/executor/runtime/trace-governance.test.ts`
- Modify: `src/__tests__/lib/executor/runtime/trace-replay.test.ts`
- Modify: `src/__tests__/lib/executor/runtime/writeback.test.ts`
- Modify: `src/__tests__/scripts/delivery-demo-data.test.ts`
- Modify: `src/__tests__/scripts/trace-fixture-builder-script.test.ts`
- Modify: `src/__tests__/lib/server/state-route-factory.test.ts`

- [x] **Step 1: Narrow route and mock call values**

Use explicit captured-value types in the agent stream test:

```ts
let capturedRequest: AgentRunRequest | undefined;
// After the route call:
expect(capturedRequest).toBeDefined();
if (!capturedRequest) throw new Error("Expected agent request");
```

Use `vi.mocked(functionName).mock.calls` or a typed mock declaration in the runtime console test, then guard the first call before reading it.

- [x] **Step 2: Narrow resume and retry discriminated unions**

Before failure-only assertions:

```ts
expect(result.ok).toBe(false);
if (result.ok) throw new Error("Expected resume failure");
expect(result.error).toBe("Controlled run not found");
```

Before success-only assertions:

```ts
expect(result.ok).toBe(true);
if (!result.ok) throw new Error(result.error);
expect(result.resumedStepIds).toEqual(["human_review"]);
```

Apply the equivalent guard for `retriedStepIds` throughout `resume.test.ts`.

- [x] **Step 3: Preserve fixture literals with real domain types**

Import the relevant types and use `satisfies`:

```ts
const redaction = {
  redacted: true,
  reason: "trace_governance",
  summary: "sensitive fields removed",
} satisfies ControlledTraceRedaction;

const fixtureSchemaVersion = "controlled-trace-fixture/v1" satisfies ControlledTraceFixture["schemaVersion"];
```

Use `fixtureSchemaVersion` for the fixture's `schemaVersion` field so the literal does not widen to `string`. Remove the unsupported `writesTo` property from the `ExecutionStep` fixture in `trace-replay.test.ts`; keep write-target expectations only on the controlled trace plan-step fixture in `trace-fixtures.test.ts`, where `writesTo` is part of the production trace contract.

Add `auditEvents: []` to the `ControlledExecutionRunRecord` fixture.

- [x] **Step 4: Type heterogeneous demo/event fixtures**

Annotate delivery demo steps with the production step-record type and narrow with `"target" in item` / `"approval" in item` before property access. Type trace builder events as `ControlledRuntimeAuditEvent[]` so `approval_resolved` and `console_retry_requested` remain valid union members.

- [x] **Step 5: Fix the missing Vitest import**

Change:

```ts
import { afterEach, describe, expect, it } from "vitest";
```

in `state-route-factory.test.ts`.

- [x] **Step 6: Verify the cluster**

Run the ten listed Vitest files, then:

```bash
npx tsc --noEmit --pretty false
```

Expected: executor, trace, demo-data, and missing-import errors are gone.

- [x] **Step 7: Commit**

```bash
git add src/__tests__/app/api/agent-stream-route.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/lib/executor/runtime src/__tests__/scripts/delivery-demo-data.test.ts src/__tests__/scripts/trace-fixture-builder-script.test.ts src/__tests__/lib/server/state-route-factory.test.ts
git commit -m "test: align executor fixtures with runtime contracts"
```

### Task 4: Playbook and Release Script Type Contracts

**Files:**
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-handoff-summary.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.test.ts`
- Modify: `src/__tests__/lib/executor/playbooks/lifecycle-sequence-evidence-freshness.test.ts`
- Modify: `src/__tests__/scripts/playbook-lifecycle-sequence-evidence-doctor-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts`
- Modify: `src/__tests__/scripts/playbook-lifecycle-mutation-executor-script.test.ts`
- Modify: `src/__tests__/scripts/playbook-lifecycle-mutation-preflight-script.test.ts`
- Modify: `src/__tests__/scripts/project-closeout-check-script.test.ts`
- Modify: `scripts/playbooks/doctor-playbook-lifecycle-sequence-evidence.mjs`
- Modify: `scripts/release-handoff/status-release-handoff-evidence.mjs`
- Modify: `scripts/release-handoff/check-release-handoff-snapshot.mjs`
- Modify: `scripts/release-handoff/index-release-handoff-snapshots.mjs`
- Modify: `scripts/playbooks/run-playbook-lifecycle-mutation-executor.mjs`
- Modify: `scripts/playbooks/check-playbook-lifecycle-mutation-preflight.mjs`
- Modify: `scripts/project-closeout/check-project-closeout.mjs`

- [x] **Step 1: Make partial upstream reports explicit in validator APIs**

For tests that intentionally pass partial upstream reports, define the validator option to accept the minimal report contract it actually consumes. Example:

```ts
type FixtureRefreshReviewReport = Pick<
  ReturnType<typeof validateFixtureRefreshHandoff>,
  | "ok"
  | "productionReady"
  | "publishingPerformed"
  | "handoffOnly"
  | "readyForFixtureRefreshReview"
  | "handoff"
  | "findings"
>;
```

Prefer named exported input contracts in production validators when the same partial boundary is used by more than one test or caller.

- [x] **Step 2: Remove stale options or add missing supported options**

- Remove `sequencePath` from the freshness validator call if production no longer consumes it.
- Add `evidencePath` to the evidence-doctor function's documented/inferred options because the function reads that value through its CLI path.
- Thread `gitRunner` through evidence status to the doctor dependency.
- Thread `snapshotPath` and `limit` through snapshot check/index functions where tests and runtime both use them.

Use JSDoc option typedefs on `.mjs` exports so TypeScript sees the complete injectable surface:

```js
/**
 * @param {{
 *   evidencePath?: string,
 *   cwd?: string,
 *   fileExists?: (path: string) => boolean,
 *   buildFreshnessResult?: (options: Record<string, unknown>) => { exitCode: number, stdout: string }
 * }} options
 */
```

- [x] **Step 3: Narrow conditional report variants**

Before reading `failures`, `failedCheck`, or excerpt fields, use property checks. Do not cast an entire report to `any`.

- [x] **Step 4: Add precise callback parameter types**

Annotate test-local callbacks:

```ts
function cliResult(report: Record<string, unknown>, exitCode = report.ok === true ? 0 : 1) {
  return { exitCode, stdout: JSON.stringify(report) };
}

let written = "";
const writeFile = (content: string) => {
  written = content;
};

const commands: string[] = [];
const commandRunner = (command: string) => {
  commands.push(command);
  return spawnResult({ status: 0, stdout: "ok\n" });
};
```

- [x] **Step 5: Verify all strict TypeScript errors are closed**

Run targeted script/playbook tests, then:

```bash
npx tsc --noEmit
npm test -- --silent=passed-only --reporter=dot
```

Expected: TypeScript exits 0 and all 695 tests pass.

- [x] **Step 6: Commit**

```bash
git add scripts src/__tests__/lib/executor/playbooks src/__tests__/scripts
git commit -m "test: close strict script type gaps"
```

### Task 5: DNS Resolution Policy

**Files:**
- Modify: `src/lib/server/network-policy.ts`
- Modify: `src/__tests__/lib/server/network-policy.test.ts`

- [x] **Step 1: Write resolver tests**

Add tests using an injected lookup function for public-only, private-only, mixed, loopback-allowed, loopback-denied, and empty results. The desired API is:

```ts
const target = await resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
  lookup: async () => [
    { address: "203.0.113.10", family: 4 },
    { address: "2001:db8::10", family: 6 },
  ],
});

expect(target).toMatchObject({
  hostname: "hooks.example.test",
  address: "203.0.113.10",
  family: 4,
});
```

Expect mixed/private/empty answers to reject with a typed `OutboundUrlPolicyError` code.

- [x] **Step 2: Run RED**

```bash
npx vitest run src/__tests__/lib/server/network-policy.test.ts
```

Expected: fail because asynchronous resolver and error type do not exist.

- [x] **Step 3: Implement address classification and resolution**

Add exported contracts:

```ts
export type ResolvedOutboundTarget = {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
};

export class OutboundUrlPolicyError extends Error {
  constructor(public readonly code: "invalid_url" | "blocked_url" | "dns_empty" | "dns_failed") {
    super(code);
    this.name = "OutboundUrlPolicyError";
  }
}
```

Use `node:dns/promises` `lookup(hostname, { all: true, verbatim: true })` by default. Validate every answer with the existing IP policy and select the first answer only after the whole set passes.

- [x] **Step 4: Run GREEN**

```bash
npx vitest run src/__tests__/lib/server/network-policy.test.ts
npx tsc --noEmit
```

Expected: resolver tests and strict type check pass.

- [x] **Step 5: Commit**

```bash
git add src/lib/server/network-policy.ts src/__tests__/lib/server/network-policy.test.ts
git commit -m "feat: validate webhook DNS destinations"
```

### Task 6: Pinned Publish Webhook Transport

**Files:**
- Create: `src/lib/server/publish-webhook-transport.ts`
- Create: `src/__tests__/lib/server/publish-webhook-transport.test.ts`

- [x] **Step 1: Write transport tests around injected request creation**

Define tests for pinned lookup, original hostname/Host header, redirect rejection, 20,000-byte response cap, timeout destruction, and connection errors. Desired result contract:

```ts
type PublishWebhookResponse = {
  ok: boolean;
  status: number;
  responseText: string;
};

await postPublishWebhook({
  url: "https://hooks.example.test/publish",
  body: "{}",
  timeoutMs: 10_000,
  allowLoopback: true,
  resolveTarget: fakeResolver,
  requestFactory: fakeRequestFactory,
});
```

- [x] **Step 2: Run RED**

```bash
npx vitest run src/__tests__/lib/server/publish-webhook-transport.test.ts
```

Expected: fail because transport module does not exist.

- [x] **Step 3: Implement the pinned request**

Use `node:http` or `node:https` based on protocol. Pass a lookup callback that returns exactly `target.address` and `target.family`. Set JSON headers and `Content-Length`, preserve the URL hostname, reject 3xx without following, collect at most 20,000 bytes, and destroy on timeout/overflow.

Export a typed error:

```ts
export class PublishWebhookTransportError extends Error {
  constructor(
    public readonly code: "blocked_url" | "dns_failed" | "timeout" | "response_too_large" | "connection_failed",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "PublishWebhookTransportError";
  }
}
```

- [x] **Step 4: Run GREEN**

```bash
npx vitest run src/__tests__/lib/server/publish-webhook-transport.test.ts
npx tsc --noEmit
```

- [x] **Step 5: Commit**

```bash
git add src/lib/server/publish-webhook-transport.ts src/__tests__/lib/server/publish-webhook-transport.test.ts
git commit -m "feat: pin publish webhook connections"
```

### Task 7: Publish Dispatch Integration

**Files:**
- Modify: `src/lib/server/publish-dispatch.ts`
- Modify: `src/__tests__/lib/server/publish-dispatch.test.ts`
- Modify: `scripts/regression/publish.mjs`

- [x] **Step 1: Add failing integration expectations**

Inject a `postWebhook` dependency into `runPublishDispatch` for tests. Cover successful receipt parsing, blocked DNS, redirect response, timeout, oversized response, and connection failure while preserving manual and dry-run behavior.

- [x] **Step 2: Run RED**

```bash
npx vitest run src/__tests__/lib/server/publish-dispatch.test.ts
npm run test:publish
```

Expected: new dependency/error mapping expectations fail before integration.

- [x] **Step 3: Delegate to the transport**

Replace direct `fetch` with:

```ts
const response = await postWebhook({
  url: webhookUrl,
  body: JSON.stringify(payload),
  timeoutMs: timeoutSeconds * 1_000,
  allowLoopback: true,
});
```

Parse `response.responseText` with the existing connector parser. Map policy errors to `blocked_url`, timeouts/connections to retryable `temporary`, overflow to non-retryable `response_too_large`, and 3xx status to an unsuccessful webhook receipt.

- [x] **Step 4: Run GREEN**

```bash
npx vitest run src/__tests__/lib/server/publish-dispatch.test.ts src/__tests__/lib/server/publish-webhook-transport.test.ts src/__tests__/lib/server/network-policy.test.ts
npm run test:publish
npx tsc --noEmit
```

- [x] **Step 5: Commit**

```bash
git add src/lib/server/publish-dispatch.ts src/__tests__/lib/server/publish-dispatch.test.ts scripts/regression/publish.mjs
git commit -m "feat: secure publish webhook dispatch"
```

### Task 8: Full Verification and Closeout

**Files:**
- Modify: `docs/PROJECT_AUDIT_OPTIMIZATION_CLOSEOUT_2026-07-16.zh-CN.md`
- Modify: `memory/2026-07-16.md` in the main workspace after integration

- [x] **Step 1: Run all verification gates**

```bash
npx tsc --noEmit
npm test -- --silent=passed-only --reporter=dot
npm run test:stability
cargo check --manifest-path src-tauri/Cargo.toml --quiet
python3 -m compileall -q lobster-sidecar deploy/desktop-runtime/lobster-fastapi-sidecar
npm run desktop:smoke-test-sidecar
git diff --check
```

Expected: every command exits 0. Run sidecar smoke with normal host approval if loopback listening is sandboxed.

- [x] **Step 2: Update the closeout report**

Record:

- deterministic clean-worktree baseline
- `npx tsc --noEmit` result
- final Vitest file/test counts
- DNS all-answer validation and pinned connection behavior
- redirect, timeout, and response-size policy
- Next.js 15.1.6 security upgrade as the next dependency-maintenance priority
- unchanged desktop release and visual redesign boundaries

- [x] **Step 3: Final diff review**

```bash
git status --short
git diff --stat HEAD~1
git log --oneline --decorate -10
```

Confirm no ignored output, credentials, generated desktop binaries, or unrelated user files are staged.

- [x] **Step 4: Commit documentation**

```bash
git add docs/PROJECT_AUDIT_OPTIMIZATION_CLOSEOUT_2026-07-16.zh-CN.md
git commit -m "docs: close engineering hardening stage two"
```

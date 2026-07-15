# Engineering Hardening Stage 2 Design

## Objective

Close two documented engineering risks without weakening existing safety or test boundaries:

1. Make the test baseline deterministic in a clean clone or isolated Git worktree.
2. Make `npx tsc --noEmit` pass with the full strict project scope, including tests.
3. Prevent publish webhooks from connecting to private addresses through DNS resolution, redirects, or an address change between validation and connection.

This stage does not perform desktop release packaging, redesign onboarding UI, prune dependencies, contact external services, or claim production readiness.

## Selected Approach

Use strict, staged remediation.

- Fix type errors at their real ownership boundary. Keep tests inside the root TypeScript project and keep `strict: true`; do not hide errors with exclusions, broad casts, `skipLibCheck` changes, or relaxed compiler flags.
- Remove the mutation-preflight test's dependency on untracked local closeout evidence by injecting deterministic green upstream gate results while continuing to read the committed dry-run fixture.
- Replace the publish webhook's direct `fetch` path with a focused server helper that resolves and validates the destination, pins the selected address into the actual HTTP(S) connection, rejects redirects, enforces timeout and response-size limits, and preserves the original hostname for HTTP `Host` and TLS SNI.
- Complete the type-check stage before changing network transport so each failure set remains attributable.

## Considered Alternatives

### Split or Relax TypeScript Configuration

Create a production-only `tsconfig` and exclude tests from the root check. This would make a command green quickly but would leave 87 known errors in active test code. Rejected because it changes the measurement rather than fixing the debt.

### DNS Preflight Followed by Normal `fetch`

Resolve the hostname, reject private answers, and then call `fetch` with the original URL. Rejected because `fetch` performs another lookup, leaving a DNS rebinding/time-of-check-to-time-of-use window. Automatic redirects would also create a second unvalidated destination.

### Strict Remediation With a Pinned Transport

Fix test and script types, then connect through Node HTTP(S) with a custom lookup result selected from the validated address set. This is the selected approach because the validation decision controls the actual socket destination.

## Type-Check Architecture

The root `tsconfig.json` remains the canonical strict check. Remediation follows these rules:

1. **Production API types first.** When several tests fail because an injected script dependency is typed as the full Node `SpawnSyncReturns`, define the smallest structural result required by that script instead of forcing test doubles to emulate unused process fields.
2. **Stable result shapes.** Script report builders must expose explicit optional failure fields and excerpts in their return contracts. Tests should not rely on properties that TypeScript cannot prove exist.
3. **Discriminated unions.** Tests for resume/retry results must narrow on `ok` or `status` before reading success-only or failure-only properties.
4. **Typed fixtures.** Use `satisfies`, literal preservation, and focused fixture builders for governed traces, playbook reports, execution records, and event types. Do not use broad `as any` to silence structural drift.
5. **Test-local defects.** Add missing Vitest imports, parameter annotations, and accurate mock call typing where the error belongs only to a test.
6. **JavaScript script boundaries.** Add concise JSDoc contracts to `.mjs` exports when TypeScript consumers need a stable injectable options or report shape. Keep runtime behavior unchanged.

The acceptance command is the unchanged `npx tsc --noEmit`.

## Deterministic Baseline

The tracked-example mutation-preflight test must not depend on `output/`, generated release evidence, or other ignored local state. It will continue to load the committed dry-run JSON while injecting deterministic successful closeout and dry-run checker results. The assertion remains an integration test for preflight validation and serialization, but becomes reproducible in CI, a clean clone, and an isolated worktree.

The Next.js 15.1.6 security upgrade warning discovered during isolated dependency installation is recorded for the next dependency-maintenance stage. Upgrading the framework is intentionally excluded here because it requires its own compatibility and browser regression cycle.

## Outbound Network Architecture

### Resolution

Add an asynchronous resolver in the server network-policy layer. It accepts a URL and policy options plus an injectable DNS lookup function for deterministic tests.

The resolver returns a target containing:

- parsed URL
- original hostname
- selected numeric address
- address family

Policy rules:

- Invalid or non-HTTP(S) URLs fail closed.
- Literal IPs are validated without DNS.
- Public hostnames must resolve successfully and every returned A/AAAA address must be public.
- Local aliases allowed by `allowLoopback` must resolve only to loopback addresses.
- Mixed public/private answers are rejected; the helper never selects the convenient public answer while ignoring a private one.
- Existing `allowLocal` behavior remains available only to current callers that explicitly request broader local access.

### Pinned HTTP(S) Request

Create a publish-webhook transport helper under `src/lib/server/` using `node:http` and `node:https`.

- The request URL retains the original hostname, path, query, and port.
- A custom `lookup` callback returns only the validated numeric address and family, so the socket cannot perform a second uncontrolled lookup.
- HTTPS retains the original hostname for certificate verification and SNI.
- Redirect responses are not followed. A connector must provide its final endpoint; 3xx responses are returned as unsuccessful connector receipts.
- The JSON request body and existing connector token payload remain unchanged.
- Response collection stops at 20,000 bytes. An oversized response fails with a stable `response_too_large` error.
- The request uses the bounded dispatch timeout. Timeout and transport failures retain retryable temporary-error semantics.

### Publish Integration

`runPublishDispatch` delegates webhook POSTs to the new helper. Existing manual mode, dry-run mode, connector payload parsing, receipt mapping, status preservation, and aggregate `ok` behavior remain unchanged.

Blocked destinations continue to return `errorType: "blocked_url"`. DNS failures return a non-retryable invalid-destination result unless the failure is explicitly classified as a transient resolver error. Timeouts and connection failures remain retryable.

## Error Handling

- Type remediation must not change runtime branches merely to satisfy inference.
- Resolver and transport errors use typed error codes rather than message matching.
- No sensitive token, request body, or DNS response is logged.
- The transport destroys its request on timeout or response overflow.
- Empty DNS results, unsupported address families, redirects, and mixed address sets fail closed.

## Testing

### Type Stage

- Run the isolated baseline suite first and require all 695 tests to pass without copying ignored evidence into the worktree.
- Run the relevant Vitest file after each fixture or API typing change.
- Run `npx tsc --noEmit` after each error cluster.
- Preserve all existing runtime assertions; type fixes must not delete or weaken tests.

### Network Stage

Write failing tests before implementation for:

- public hostname with public A/AAAA results
- hostname with a private result
- mixed public/private results
- loopback alias with explicit loopback permission
- loopback alias without permission
- literal public, private, and loopback IPs
- pinned lookup returning the validated address
- redirect rejection
- response-size limit
- timeout and connection-error classification
- unchanged connector receipt parsing and aggregate publish behavior

DNS and transport tests use injected lookup/request dependencies or local fakes; they do not call the public internet.

## Verification

The stage is complete only when all commands pass:

```bash
npx tsc --noEmit
npm test -- --silent=passed-only --reporter=dot
npm run test:stability
cargo check --manifest-path src-tauri/Cargo.toml --quiet
python3 -m compileall -q lobster-sidecar deploy/desktop-runtime/lobster-fastapi-sidecar
npm run desktop:smoke-test-sidecar
git diff --check
```

The closeout report and daily memory are updated with the new evidence and remaining release/design boundaries.

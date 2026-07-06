# Delivery Release Gate Hardening Design

Date: 2026-07-06

## Context

The project is now local delivery demo ready, but the release gate is still
spread across several documents and manual commands. Maintainers currently need
to remember which checks prove the controlled runtime demo path, governed trace
fixture health, and retention handoff are still safe.

The next phase should convert that scattered checklist into one local
operator-facing gate without expanding runtime behavior.

## Goal

Add a local delivery readiness command:

```bash
npm run delivery:ready:check
```

The command should run existing no-external-side-effect checks and print a
machine-readable JSON report that answers:

- did the delivery demo state pass validation;
- did governed trace fixture checks pass;
- did retention preview remain inspectable;
- what release claim is allowed.

The only allowed positive release claim for this phase is:

```text
local_delivery_demo_ready
```

The command must not claim production readiness.

## Non-Goals

- No browser automation.
- No dev server startup.
- No real replay.
- No LLM or tool execution replay.
- No fixture refresh.
- No committed fixture JSON mutation.
- No route calls beyond existing subprocess commands.
- No external system mutation.
- No business asset writes beyond whatever already exists in the local demo
  check path.
- No UI changes.

## Command Contract

Script path:

```text
scripts/delivery-ready/check-delivery-ready.mjs
```

Package script:

```json
"delivery:ready:check": "node scripts/delivery-ready/check-delivery-ready.mjs"
```

Default checks:

1. `npm run delivery:demo:check`
2. `npm run trace:fixtures --silent`
3. `npm run trace:fixtures:summary --silent`
4. `npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20`

The command intentionally does not run:

- `npm run delivery:demo:seed`;
- `npm run test:controlled-runtime`;
- `npm run test:core-workflows`;
- `npm run lint`;
- `npm run build`;
- browser smoke.

Those remain heavier verification gates. This command is the fast local
delivery readiness gate that can run before or between full verification passes.

## Output Contract

On success, stdout should be JSON:

```json
{
  "ok": true,
  "command": "delivery:ready:check",
  "releaseClaim": "local_delivery_demo_ready",
  "productionReady": false,
  "checks": [
    {
      "name": "delivery_demo_check",
      "command": "npm run delivery:demo:check",
      "ok": true,
      "exitCode": 0
    }
  ],
  "knownWarnings": [
    "production readiness is not claimed by this gate",
    "browser smoke remains a manual evidence step"
  ]
}
```

On failure:

- stdout still prints JSON;
- `ok` is `false`;
- the failed check includes `exitCode`, `stdout`, and `stderr` excerpts;
- process exit code is `1`;
- later checks may stop after the first failure to keep diagnostics focused.

The command should preserve machine-readable stdout. Human diagnostics should be
embedded in JSON instead of mixed into stderr, except for unexpected top-level
script errors.

## Error Handling

The gate should fail closed when:

- any default check exits non-zero;
- a subprocess cannot be started;
- a required command returns malformed JSON where JSON is needed for validation.

The first implementation only needs to verify subprocess exit codes. It should
not parse every downstream command deeply, except where a simple JSON parse is
already reliable and adds value. The delivery demo check should be parsed enough
to ensure `ok === true`.

## Documentation Updates

Update:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md`
- `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-06.md`

Docs must say clearly:

- `delivery:ready:check` is a fast local delivery gate;
- it does not replace full regression, lint, build, or browser smoke;
- it does not claim production readiness;
- production readiness remains out of scope for the current branch.

## Testing

Add `src/__tests__/scripts/delivery-ready-check-script.test.ts`.

Coverage:

- returns success JSON when all checks exit 0;
- returns failure JSON and exit code `1` when a check fails;
- parses `delivery:demo:check` JSON and rejects `ok: false` even if the process
  exits 0;
- truncates captured stdout/stderr in failed check diagnostics;
- keeps `releaseClaim` equal to `local_delivery_demo_ready` and
  `productionReady` equal to `false`.

The test should avoid running the full project commands. It can import exported
helpers from the script and use injected subprocess runners.

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/delivery-ready-check-script.test.ts
npm run delivery:ready:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- all commands exit 0;
- lint/build may keep the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`;
- `npm run delivery:ready:check` outputs JSON with
  `"releaseClaim": "local_delivery_demo_ready"` and
  `"productionReady": false`.

# Local Release Handoff Gate Design

Date: 2026-07-07

## Context

AgentCore OS now has two focused local gates:

- `npm run release:hygiene:check` for open-source repository hygiene;
- `npm run delivery:ready:check` for the fast local controlled-runtime delivery
  demo readiness claim.

The remaining release-handoff checklist is still a command sequence maintained
in documentation. Before a public handoff, maintainers must remember to run the
hygiene gate, delivery gate, controlled-runtime regression, core workflow
regression, lint, build, and diff whitespace check.

The next phase should make that full local handoff sequence repeatable without
performing any publication action.

## Goal

Add a local release handoff command:

```bash
npm run release:handoff:check
```

The command should run the current full local verification baseline and print a
machine-readable JSON report that answers:

- did repository hygiene pass;
- did local delivery readiness pass;
- did controlled runtime tests pass;
- did core workflow regressions pass;
- did lint pass;
- did production build pass;
- did `git diff --check` pass;
- what release handoff claim is allowed.

The only allowed positive claim for this gate is:

```text
local_release_handoff_ready
```

The command must keep:

```json
{
  "productionReady": false,
  "publishingPerformed": false
}
```

## Non-Goals

- No tag creation.
- No GitHub Release creation.
- No package publishing.
- No installer packaging.
- No artifact upload.
- No git push.
- No browser automation.
- No dev server startup.
- No production readiness claim.
- No new playbook, fixture, replay, runtime, UI, or retention behavior.
- No mutation beyond the normal side effects already caused by existing local
  verification commands.

## Command Contract

Script path:

```text
scripts/release-handoff/check-release-handoff.mjs
```

Package script:

```json
"release:handoff:check": "node scripts/release-handoff/check-release-handoff.mjs"
```

Default checks, in order:

1. `npm run release:hygiene:check`
2. `npm run delivery:ready:check`
3. `npm run test:controlled-runtime`
4. `npm run test:core-workflows`
5. `npm run lint`
6. `npm run build`
7. `git diff --check`

The command should stop at the first hard failure by default to keep output
focused and avoid spending time on lower-value checks after a blocking failure.

## Output Contract

On success, stdout should be JSON:

```json
{
  "ok": true,
  "command": "release:handoff:check",
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "checks": [
    {
      "name": "release_hygiene_check",
      "command": "npm run release:hygiene:check",
      "ok": true,
      "exitCode": 0,
      "durationMs": 120
    }
  ],
  "knownWarnings": [
    "production readiness is not claimed by this gate",
    "no publishing, tagging, uploading, or installer packaging is performed"
  ]
}
```

On failure:

- stdout still prints JSON;
- `ok` is `false`;
- `releaseClaim` is omitted;
- `productionReady` remains `false`;
- `publishingPerformed` remains `false`;
- the failed check includes `exitCode`, `durationMs`, `stdoutExcerpt`, and
  `stderrExcerpt`;
- process exit code is `1`;
- later checks may be skipped.

Unexpected top-level script errors may print to stderr and exit non-zero.

## Warning Handling

Some existing commands can succeed while printing known warnings:

- `npm run lint` and `npm run build` may report the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`.
- `npm run release:hygiene:check` may report warning-only secret pattern review
  results.

The handoff gate should not parse all child-command warning details deeply in
the first implementation. It should record command pass/fail and include known
warning text in the top-level report. The source command remains responsible for
its own structured warning details.

## Error Handling

The gate should fail closed when:

- any default check exits non-zero;
- a subprocess cannot be started;
- the runner returns no numeric status.

Failure diagnostics should be machine-readable. The script should not mix normal
human diagnostics into stderr except for unexpected top-level errors.

## Documentation Updates

Update:

- `CHANGELOG.md`
- `README.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-07.md`

Docs must say clearly:

- `release:handoff:check` is the full local handoff gate;
- it includes `release:hygiene:check` and `delivery:ready:check`;
- it runs heavier regression, lint, build, and diff checks;
- it does not publish, tag, upload, package installers, or claim production
  readiness.

## Testing

Add `src/__tests__/scripts/release-handoff-check-script.test.ts`.

Coverage:

- returns success JSON when all checks exit 0;
- emits `releaseClaim: "local_release_handoff_ready"` only on success;
- keeps `productionReady: false` and `publishingPerformed: false`;
- runs checks in the documented order;
- fails closed when a check exits non-zero;
- stops after the first failure;
- truncates failed stdout/stderr excerpts;
- treats missing numeric subprocess status as failure.

Tests should import exported helpers from the script and use an injected runner
instead of running the full command sequence.

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-check-script.test.ts
npm run release:handoff:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- all commands exit 0;
- `release:handoff:check` outputs JSON with
  `"releaseClaim": "local_release_handoff_ready"`;
- `productionReady` is `false`;
- `publishingPerformed` is `false`;
- lint/build may keep the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`.

## Spec Self-Review

- Placeholder scan: no placeholder requirements remain.
- Internal consistency: command name, claim, output fields, default checks,
  non-goals, docs, tests, and verification describe the same local handoff gate.
- Scope check: this is one implementation slice and does not include publishing,
  tagging, installer packaging, browser smoke, runtime behavior, UI work, or
  production readiness.
- Ambiguity check: the gate runs the full local command baseline and stops on
  first hard failure; child-command warning details stay owned by child commands.

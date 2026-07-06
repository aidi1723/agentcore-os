# Delivery Release Gate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast local delivery readiness gate that aggregates existing safe checks and only claims `local_delivery_demo_ready`.

**Architecture:** Create a Node ESM script with small exported helpers and an injectable subprocess runner so tests can cover success/failure behavior without running heavyweight commands. The CLI uses the existing package scripts, emits machine-readable JSON, and exits non-zero on failed gates.

**Tech Stack:** Node ESM, `spawnSync`, existing npm scripts, Vitest, current documentation set.

---

## Files

- Create: `scripts/delivery-ready/check-delivery-ready.mjs`
- Create: `src/__tests__/scripts/delivery-ready-check-script.test.ts`
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md`
- Modify: `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Failing Delivery Ready Gate Tests

- [x] Create `src/__tests__/scripts/delivery-ready-check-script.test.ts`.

- [x] Import the planned helper:

```ts
import {
  buildDeliveryReadyReport,
  DELIVERY_READY_RELEASE_CLAIM,
} from "../../../scripts/delivery-ready/check-delivery-ready.mjs";
```

- [x] Add a success test with an injected runner:

```ts
it("returns local delivery demo ready when all checks pass", () => {
  const result = buildDeliveryReadyReport({
    runner: (check) => ({
      status: 0,
      stdout:
        check.name === "delivery_demo_check"
          ? JSON.stringify({ ok: true, diagnostics: [] })
          : "ok",
      stderr: "",
    }),
  });

  expect(result).toMatchObject({
    exitCode: 0,
    report: {
      ok: true,
      command: "delivery:ready:check",
      releaseClaim: DELIVERY_READY_RELEASE_CLAIM,
      productionReady: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "delivery_demo_check", ok: true }),
        expect.objectContaining({ name: "trace_fixtures_report", ok: true }),
        expect.objectContaining({ name: "trace_fixtures_summary", ok: true }),
        expect.objectContaining({ name: "trace_retention_preview", ok: true }),
      ]),
    },
  });
});
```

- [x] Add a failing subprocess test:

```ts
it("fails closed when a check exits non-zero", () => {
  const result = buildDeliveryReadyReport({
    runner: (check) =>
      check.name === "trace_fixtures_report"
        ? { status: 1, stdout: "fixture failure", stderr: "bad fixture" }
        : { status: 0, stdout: "{\"ok\":true}", stderr: "" },
  });

  expect(result.exitCode).toBe(1);
  expect(result.report).toMatchObject({
    ok: false,
    productionReady: false,
    failedCheck: "trace_fixtures_report",
  });
  expect(result.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "trace_fixtures_report",
        ok: false,
        exitCode: 1,
        stdoutExcerpt: "fixture failure",
        stderrExcerpt: "bad fixture",
      }),
    ]),
  );
});
```

- [x] Add a delivery JSON semantic failure test:

```ts
it("rejects delivery demo JSON with ok false even when the process exits zero", () => {
  const result = buildDeliveryReadyReport({
    runner: (check) => ({
      status: 0,
      stdout:
        check.name === "delivery_demo_check"
          ? JSON.stringify({ ok: false, diagnostics: ["missing draft"] })
          : "ok",
      stderr: "",
    }),
  });

  expect(result.exitCode).toBe(1);
  expect(result.report.failedCheck).toBe("delivery_demo_check");
  expect(result.report.checks[0]).toMatchObject({
    ok: false,
    validationError: "delivery demo check returned ok=false",
  });
});
```

- [x] Add an excerpt truncation test:

```ts
it("truncates failed check stdout and stderr excerpts", () => {
  const longText = "x".repeat(700);
  const result = buildDeliveryReadyReport({
    excerptLength: 80,
    runner: () => ({ status: 1, stdout: longText, stderr: longText }),
  });

  const failed = result.report.checks[0];
  expect(failed.stdoutExcerpt.length).toBeLessThanOrEqual(80);
  expect(failed.stderrExcerpt.length).toBeLessThanOrEqual(80);
  expect(failed.stdoutExcerpt.endsWith("...")).toBe(true);
});
```

- [x] Run:

```bash
npm test -- src/__tests__/scripts/delivery-ready-check-script.test.ts
```

Expected: fail because `scripts/delivery-ready/check-delivery-ready.mjs` does not exist yet.

Result: failed because `scripts/delivery-ready/check-delivery-ready.mjs` did not exist.

## Task 2: Implement Delivery Ready Script

- [x] Create `scripts/delivery-ready/check-delivery-ready.mjs`.

- [x] Add constants and check definitions:

```js
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DELIVERY_READY_RELEASE_CLAIM = "local_delivery_demo_ready";

export const DEFAULT_DELIVERY_READY_CHECKS = [
  {
    name: "delivery_demo_check",
    command: "npm run delivery:demo:check",
    args: ["run", "delivery:demo:check", "--silent"],
    parseJson: true,
    requireOk: true,
  },
  {
    name: "trace_fixtures_report",
    command: "npm run trace:fixtures --silent",
    args: ["run", "trace:fixtures", "--silent"],
  },
  {
    name: "trace_fixtures_summary",
    command: "npm run trace:fixtures:summary --silent",
    args: ["run", "trace:fixtures:summary", "--silent"],
  },
  {
    name: "trace_retention_preview",
    command:
      "npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20",
    args: [
      "run",
      "trace:retention:preview",
      "--silent",
      "--",
      "--max-age-days",
      "30",
      "--min-terminal-runs",
      "20",
    ],
  },
];
```

- [x] Add the default runner:

```js
export function runDeliveryReadySubprocess(check) {
  return spawnSync("npm", check.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
```

- [x] Add excerpt and JSON helper behavior:

```js
export function excerptText(value, maxLength = 600) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseJsonOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
```

- [x] Add check execution:

```js
function evaluateCheck(check, rawResult, excerptLength) {
  const exitCode = typeof rawResult.status === "number" ? rawResult.status : 1;
  const base = {
    name: check.name,
    command: check.command,
    ok: exitCode === 0,
    exitCode,
  };

  if (check.parseJson || check.requireOk) {
    const parsed = parseJsonOutput(rawResult.stdout);
    if (!parsed) {
      return {
        ...base,
        ok: false,
        validationError: "check stdout was not valid JSON",
        stdoutExcerpt: excerptText(rawResult.stdout, excerptLength),
        stderrExcerpt: excerptText(rawResult.stderr, excerptLength),
      };
    }
    if (check.requireOk && parsed.ok !== true) {
      return {
        ...base,
        ok: false,
        validationError: "delivery demo check returned ok=false",
        diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
        stdoutExcerpt: excerptText(rawResult.stdout, excerptLength),
        stderrExcerpt: excerptText(rawResult.stderr, excerptLength),
      };
    }
  }

  if (exitCode !== 0) {
    return {
      ...base,
      ok: false,
      stdoutExcerpt: excerptText(rawResult.stdout, excerptLength),
      stderrExcerpt: excerptText(rawResult.stderr, excerptLength),
    };
  }

  return base;
}
```

- [x] Add `buildDeliveryReadyReport()`:

```js
export function buildDeliveryReadyReport({
  checks = DEFAULT_DELIVERY_READY_CHECKS,
  runner = runDeliveryReadySubprocess,
  excerptLength = 600,
} = {}) {
  const results = [];
  for (const check of checks) {
    const rawResult = runner(check);
    const result = evaluateCheck(check, rawResult, excerptLength);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((check) => !check.ok);
  const report = {
    ok: !failed,
    command: "delivery:ready:check",
    releaseClaim: DELIVERY_READY_RELEASE_CLAIM,
    productionReady: false,
    checks: results,
    knownWarnings: [
      "production readiness is not claimed by this gate",
      "browser smoke remains a manual evidence step",
      "full regression, lint, and build gates remain separate verification steps",
    ],
  };

  if (failed) {
    report.failedCheck = failed.name;
  }

  return {
    exitCode: failed ? 1 : 0,
    report,
  };
}
```

- [x] Add the CLI main:

```js
function main() {
  const result = buildDeliveryReadyReport();
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
```

- [x] Run:

```bash
npm test -- src/__tests__/scripts/delivery-ready-check-script.test.ts
```

Expected: pass.

Result: passed, 4 tests.

## Task 3: Package Script And Runtime Gate Inclusion

- [x] Modify `package.json` and add:

```json
"delivery:ready:check": "node scripts/delivery-ready/check-delivery-ready.mjs"
```

- [x] Add `src/__tests__/scripts/delivery-ready-check-script.test.ts` to `test:controlled-runtime`.

- [x] Run:

```bash
npm run delivery:ready:check
npm run test:controlled-runtime
```

Expected:

- `delivery:ready:check` exits 0 and prints JSON with `"releaseClaim": "local_delivery_demo_ready"` and `"productionReady": false`.
- `test:controlled-runtime` passes.

Result:

- `delivery:ready:check` exited 0 and printed JSON with `"releaseClaim": "local_delivery_demo_ready"` and `"productionReady": false`.
- `test:controlled-runtime` passed, 41 files / 210 tests.

## Task 4: Documentation And Records

- [x] Update `CHANGELOG.md` under the current unreleased/runtime section:

```md
- Added `npm run delivery:ready:check`, a fast local delivery readiness gate that aggregates delivery demo validation, governed trace fixture checks, and retention preview while only claiming `local_delivery_demo_ready`.
```

- [x] Update `docs/NEXT_STEPS.md` completed baseline and current verification baseline to include:

```bash
npm run delivery:ready:check
```

- [x] Add a completed section to `docs/NEXT_STEPS.md` explaining:

```md
## Completed. Delivery Release Gate Hardening

- Added a fast local delivery readiness gate.
- The gate runs delivery demo check, governed fixture report, governed fixture summary, and retention preview.
- The gate emits JSON and keeps `productionReady: false`.
- Full regression, lint, build, and browser smoke remain separate gates.
```

- [x] Update `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md` to say `delivery:ready:check` is a fast command-level gate before manual browser evidence.

- [x] Update `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md` to include `npm run delivery:ready:check` after seed/check.

- [x] Update `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md` current snapshot with the new gate and its non-production claim boundary.

- [x] Update `memory/2026-07-06.md` with phase progress and targeted verification.

## Task 5: Final Verification And Commit

- [x] Run:

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
- `npm run lint` and `npm run build` may keep the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`;
- `npm run delivery:ready:check` outputs JSON with `ok: true`, `releaseClaim: "local_delivery_demo_ready"`, and `productionReady: false`.

Result:

- `npm test -- src/__tests__/scripts/delivery-ready-check-script.test.ts` — 4 tests passed.
- `npm run delivery:ready:check` — exit 0; output `ok: true`, `releaseClaim: "local_delivery_demo_ready"`, and `productionReady: false`.
- `npm run test:controlled-runtime` — 41 files / 210 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

- [ ] Stage only current phase files:

```bash
git add \
  CHANGELOG.md \
  docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md \
  docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md \
  docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md \
  docs/NEXT_STEPS.md \
  docs/superpowers/plans/2026-07-06-delivery-release-gate-hardening.md \
  memory/2026-07-06.md \
  package.json \
  scripts/delivery-ready/check-delivery-ready.mjs \
  src/__tests__/scripts/delivery-ready-check-script.test.ts
```

- [ ] Commit:

```bash
git commit -m "feat: add delivery readiness gate"
```

- [ ] Push:

```bash
git push origin main
```

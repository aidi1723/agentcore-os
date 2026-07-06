# Local Release Handoff Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run release:handoff:check`, a full local handoff gate that aggregates existing release, delivery, regression, lint, build, and diff checks without performing publication.

**Architecture:** Create one Node ESM CLI with exported pure helpers and an injectable command runner. The CLI executes the documented command sequence, stops at the first hard failure, emits JSON, and keeps `productionReady: false` plus `publishingPerformed: false`.

**Tech Stack:** Node ESM, `spawnSync`, Vitest, existing npm scripts, git diff check, current release documentation.

---

## Files

- Create: `scripts/release-handoff/check-release-handoff.mjs`
- Create: `src/__tests__/scripts/release-handoff-check-script.test.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Create or update: `memory/2026-07-07.md`

## Task 1: Failing Release Handoff Tests

- [x] Create `src/__tests__/scripts/release-handoff-check-script.test.ts`.

- [x] Import planned helpers from the missing script:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RELEASE_HANDOFF_CHECKS,
  RELEASE_HANDOFF_COMMAND,
  RELEASE_HANDOFF_CLAIM,
  buildReleaseHandoffReport,
} from "../../../scripts/release-handoff/check-release-handoff.mjs";
```

- [x] Add a success test:

```ts
it("returns local handoff ready when all checks pass", () => {
  const seen: string[] = [];
  const result = buildReleaseHandoffReport({
    runner: (check) => {
      seen.push(check.name);
      return { status: 0, stdout: `${check.name} ok`, stderr: "" };
    },
  });

  expect(seen).toEqual(DEFAULT_RELEASE_HANDOFF_CHECKS.map((check) => check.name));
  expect(result).toMatchObject({
    exitCode: 0,
    report: {
      ok: true,
      command: RELEASE_HANDOFF_COMMAND,
      releaseClaim: RELEASE_HANDOFF_CLAIM,
      productionReady: false,
      publishingPerformed: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "release_hygiene_check", ok: true }),
        expect.objectContaining({ name: "delivery_ready_check", ok: true }),
        expect.objectContaining({ name: "controlled_runtime_tests", ok: true }),
        expect.objectContaining({ name: "core_workflow_tests", ok: true }),
        expect.objectContaining({ name: "lint", ok: true }),
        expect.objectContaining({ name: "build", ok: true }),
        expect.objectContaining({ name: "diff_check", ok: true }),
      ]),
    },
  });
});
```

- [x] Add a failure test:

```ts
it("fails closed and stops after the first failing check", () => {
  const seen: string[] = [];
  const result = buildReleaseHandoffReport({
    runner: (check) => {
      seen.push(check.name);
      if (check.name === "controlled_runtime_tests") {
        return { status: 1, stdout: "test failure", stderr: "bad test" };
      }
      return { status: 0, stdout: "ok", stderr: "" };
    },
  });

  expect(seen).toEqual([
    "release_hygiene_check",
    "delivery_ready_check",
    "controlled_runtime_tests",
  ]);
  expect(result.exitCode).toBe(1);
  expect(result.report).toMatchObject({
    ok: false,
    productionReady: false,
    publishingPerformed: false,
    failedCheck: "controlled_runtime_tests",
  });
  expect(result.report).not.toHaveProperty("releaseClaim");
  expect(result.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "controlled_runtime_tests",
        ok: false,
        exitCode: 1,
        stdoutExcerpt: "test failure",
        stderrExcerpt: "bad test",
      }),
    ]),
  );
});
```

- [x] Add duration and command-order assertion:

```ts
it("records command strings and durations", () => {
  let now = 1_000;
  const result = buildReleaseHandoffReport({
    now: () => {
      now += 25;
      return now;
    },
    runner: () => ({ status: 0, stdout: "", stderr: "" }),
  });

  expect(result.report.checks[0]).toMatchObject({
    name: "release_hygiene_check",
    command: "npm run release:hygiene:check",
    durationMs: 25,
  });
  expect(result.report.checks.at(-1)).toMatchObject({
    name: "diff_check",
    command: "git diff --check",
  });
});
```

- [x] Add missing status and truncation tests:

```ts
it("treats a missing numeric process status as failure", () => {
  const result = buildReleaseHandoffReport({
    runner: () => ({ status: null, stdout: "no status", stderr: "" }),
  });

  expect(result.exitCode).toBe(1);
  expect(result.report.failedCheck).toBe("release_hygiene_check");
  expect(result.report.checks[0]).toMatchObject({
    ok: false,
    exitCode: 1,
  });
});

it("truncates failed stdout and stderr excerpts", () => {
  const longText = "x".repeat(700);
  const result = buildReleaseHandoffReport({
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
npm test -- src/__tests__/scripts/release-handoff-check-script.test.ts
```

Expected: fail because `scripts/release-handoff/check-release-handoff.mjs` does not exist yet.

## Task 2: Implement Release Handoff Script

- [x] Create `scripts/release-handoff/check-release-handoff.mjs`.

- [x] Add imports and constants:

```js
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_COMMAND = "release:handoff:check";
export const RELEASE_HANDOFF_CLAIM = "local_release_handoff_ready";
```

- [x] Add default checks:

```js
export const DEFAULT_RELEASE_HANDOFF_CHECKS = [
  {
    name: "release_hygiene_check",
    command: "npm run release:hygiene:check",
    bin: "npm",
    args: ["run", "release:hygiene:check", "--silent"],
  },
  {
    name: "delivery_ready_check",
    command: "npm run delivery:ready:check",
    bin: "npm",
    args: ["run", "delivery:ready:check", "--silent"],
  },
  {
    name: "controlled_runtime_tests",
    command: "npm run test:controlled-runtime",
    bin: "npm",
    args: ["run", "test:controlled-runtime", "--silent"],
  },
  {
    name: "core_workflow_tests",
    command: "npm run test:core-workflows",
    bin: "npm",
    args: ["run", "test:core-workflows", "--silent"],
  },
  {
    name: "lint",
    command: "npm run lint",
    bin: "npm",
    args: ["run", "lint", "--silent"],
  },
  {
    name: "build",
    command: "npm run build",
    bin: "npm",
    args: ["run", "build", "--silent"],
  },
  {
    name: "diff_check",
    command: "git diff --check",
    bin: "git",
    args: ["diff", "--check"],
  },
];
```

- [x] Add runner and excerpt helpers:

```js
export function runReleaseHandoffSubprocess(check) {
  return spawnSync(check.bin, check.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function excerptText(value, maxLength = 600) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}
```

- [x] Add check evaluator:

```js
function evaluateCheck(check, rawResult, durationMs, excerptLength) {
  const exitCode =
    typeof rawResult?.status === "number" ? rawResult.status : 1;
  const base = {
    name: check.name,
    command: check.command,
    ok: exitCode === 0,
    exitCode,
    durationMs,
  };

  if (exitCode !== 0) {
    return {
      ...base,
      stdoutExcerpt: excerptText(rawResult?.stdout, excerptLength),
      stderrExcerpt: excerptText(rawResult?.stderr, excerptLength),
    };
  }

  return base;
}
```

- [x] Add report builder:

```js
export function buildReleaseHandoffReport({
  checks = DEFAULT_RELEASE_HANDOFF_CHECKS,
  runner = runReleaseHandoffSubprocess,
  now = () => Date.now(),
  excerptLength = 600,
} = {}) {
  const results = [];
  for (const check of checks) {
    const startedAt = now();
    const rawResult = runner(check);
    const durationMs = Math.max(0, now() - startedAt);
    const result = evaluateCheck(check, rawResult, durationMs, excerptLength);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((check) => !check.ok);
  const report = {
    ok: !failed,
    command: RELEASE_HANDOFF_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    checks: results,
    knownWarnings: [
      "production readiness is not claimed by this gate",
      "no publishing, tagging, uploading, or installer packaging is performed",
      "release:hygiene:check owns warning-only secret pattern review details",
      "lint/build may report the existing <img> warning in ShellUI.test.tsx",
    ],
  };

  if (!failed) {
    report.releaseClaim = RELEASE_HANDOFF_CLAIM;
  } else {
    report.failedCheck = failed.name;
  }

  return {
    exitCode: failed ? 1 : 0,
    report,
  };
}
```

- [x] Add CLI main:

```js
function main() {
  const result = buildReleaseHandoffReport();
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
npm test -- src/__tests__/scripts/release-handoff-check-script.test.ts
```

Expected: pass.

## Task 3: Wire Package Script And Controlled Runtime Coverage

- [x] Modify `package.json` scripts:

```json
"release:handoff:check": "node scripts/release-handoff/check-release-handoff.mjs"
```

- [x] Add the new test file to `test:controlled-runtime` after
  `release-hygiene-check-script.test.ts`:

```text
src/__tests__/scripts/release-handoff-check-script.test.ts
```

- [x] Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-check-script.test.ts
npm run test:controlled-runtime
```

Expected:

- targeted test exits 0;
- `test:controlled-runtime` includes the new script coverage and exits 0.

## Task 4: Documentation And Maintenance Log

- [x] Update `README.md`.

Add `release:handoff:check` to the common scripts list as the full local
handoff gate. Make clear that it does not publish or claim production readiness.

- [x] Update `docs/OPEN_SOURCE_CHECKLIST.md`.

Add `npm run release:handoff:check` to final local verification and explain that
it aggregates hygiene, delivery readiness, regression, lint, build, and diff
checks.

- [x] Update `docs/PUBLIC_RELEASE.md` and `docs/PUBLIC_RELEASE.zh-CN.md`.

Add a short section or paragraph for the full local handoff gate after the
hygiene gate. State that it performs no publishing.

- [x] Update `docs/NEXT_STEPS.md`.

Add Local Release Handoff Gate to the completed baseline and update the current
verification baseline. After verification, update the controlled-runtime test
file/test count.

- [x] Update `CHANGELOG.md`.

Add an Unreleased bullet for `release:handoff:check`.

- [x] Create or update `memory/2026-07-07.md`.

Record spec, plan, TDD evidence, implementation, verification, and next
recommended phase.

## Task 5: Final Verification And Commit

- [x] Run targeted verification:

```bash
npm test -- src/__tests__/scripts/release-handoff-check-script.test.ts
```

- [x] Run full local handoff verification:

```bash
npm run release:handoff:check
```

- [x] Run post-handoff verification:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- all commands exit 0;
- `release:handoff:check` emits `releaseClaim: "local_release_handoff_ready"`;
- `productionReady` is `false`;
- `publishingPerformed` is `false`;
- lint/build may keep the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`.

- [x] Commit:

```bash
git add scripts/release-handoff/check-release-handoff.mjs \
  src/__tests__/scripts/release-handoff-check-script.test.ts \
  package.json \
  README.md \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  memory/2026-07-07.md \
  docs/superpowers/plans/2026-07-07-local-release-handoff-gate.md
git commit -m "feat: add local release handoff gate"
```

## Self-Review

- Spec coverage: every spec requirement maps to a task: script, tests, package
  wiring, docs, maintenance log, and verification.
- Placeholder scan: no placeholder markers remain.
- Type consistency: the plan consistently uses `release:handoff:check`,
  `RELEASE_HANDOFF_COMMAND`, `RELEASE_HANDOFF_CLAIM`, and
  `buildReleaseHandoffReport()`.
- Scope check: the plan does not include publishing, release tags, GitHub
  Releases, installer packaging, browser automation, UI work, runtime changes,
  or production readiness.

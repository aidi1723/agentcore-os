# Open Source Hygiene Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only `release:hygiene:check` JSON gate for repeatable open-source repository hygiene checks.

**Architecture:** Implement one Node ESM CLI with exported pure helpers for evaluating injected repository data in tests and a thin real repository reader for CLI use. Keep hard failures separate from warning-only secret pattern review so the command can block unsafe release hygiene drift without pretending to prove the absence of secrets.

**Tech Stack:** Node ESM, `spawnSync`, `fs`, `path`, Vitest, existing npm scripts and documentation.

---

## Files

- Create: `scripts/release-hygiene/check-release-hygiene.mjs`
- Create: `src/__tests__/scripts/release-hygiene-check-script.test.ts`
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Failing Release Hygiene Tests

- [ ] Create `src/__tests__/scripts/release-hygiene-check-script.test.ts`.

- [ ] Import planned helpers from the not-yet-existing script:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HYGIENE_COMMAND,
  buildReleaseHygieneReport,
} from "../../../scripts/release-hygiene/check-release-hygiene.mjs";
```

- [ ] Define a complete passing repository fixture:

```ts
const requiredDocs = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/PRIVACY.md",
  "docs/LICENSE_CHANGE_NOTICE.md",
];

function buildFiles(overrides: Record<string, string | undefined> = {}) {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ license: "GPL-3.0-or-later" }),
    "README.md":
      "Use npm run delivery:ready:check. Production readiness is not claimed.",
    "docs/PUBLIC_RELEASE.md":
      "Use npm run delivery:ready:check. The project is not production ready.",
    "docs/PUBLIC_RELEASE.zh-CN.md":
      "Use npm run delivery:ready:check。当前尚未宣称 production ready。",
    "docs/OPEN_SOURCE_CHECKLIST.md":
      "Use npm run delivery:ready:check before handoff.",
  };

  for (const path of requiredDocs) {
    files[path] ??= "present";
  }

  for (const [path, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete files[path];
    } else {
      files[path] = value;
    }
  }

  return files;
}

function buildRepo(overrides: {
  files?: Record<string, string | undefined>;
  trackedFiles?: string[];
} = {}) {
  const files = buildFiles(overrides.files);
  return {
    trackedFiles: overrides.trackedFiles ?? Object.keys(files),
    readTextFile: (path: string) => files[path],
  };
}
```

- [ ] Add the success test:

```ts
it("returns success when repository hygiene checks pass", () => {
  const result = buildReleaseHygieneReport(buildRepo());

  expect(result).toMatchObject({
    exitCode: 0,
    report: {
      ok: true,
      command: RELEASE_HYGIENE_COMMAND,
      productionReady: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "required_docs", ok: true }),
        expect.objectContaining({ name: "package_license", ok: true }),
        expect.objectContaining({ name: "tracked_artifact_paths", ok: true }),
        expect.objectContaining({ name: "public_release_docs", ok: true }),
      ]),
    },
  });
});
```

- [ ] Add hard-failure tests:

```ts
it("fails when a required public document is missing", () => {
  const result = buildReleaseHygieneReport(
    buildRepo({ files: { "SECURITY.md": undefined } }),
  );

  expect(result.exitCode).toBe(1);
  expect(result.report.failedChecks).toContain("required_docs");
  expect(result.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "required_docs",
        ok: false,
        missing: ["SECURITY.md"],
      }),
    ]),
  );
});

it("fails when package license is not GPL-3.0-or-later", () => {
  const result = buildReleaseHygieneReport(
    buildRepo({ files: { "package.json": JSON.stringify({ license: "MIT" }) } }),
  );

  expect(result.exitCode).toBe(1);
  expect(result.report.failedChecks).toContain("package_license");
});

it("fails when blocked artifact paths are tracked", () => {
  const result = buildReleaseHygieneReport(
    buildRepo({ trackedFiles: ["README.md", "dist/app.js"] }),
  );

  expect(result.exitCode).toBe(1);
  expect(result.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "tracked_artifact_paths",
        ok: false,
        blockedFiles: ["dist/app.js"],
      }),
    ]),
  );
});

it("fails when public release docs omit delivery:ready:check", () => {
  const result = buildReleaseHygieneReport(
    buildRepo({
      files: {
        "docs/PUBLIC_RELEASE.md":
          "The public release guide describes local demo readiness.",
      },
    }),
  );

  expect(result.exitCode).toBe(1);
  expect(result.report.failedChecks).toContain("public_release_docs");
  expect(result.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "public_release_docs",
        ok: false,
        missingDeliveryReadyCheck: ["docs/PUBLIC_RELEASE.md"],
      }),
    ]),
  );
});
```

- [ ] Add production wording and warning tests:

```ts
it("allows negative production-ready boundary wording but rejects positive claims", () => {
  const negative = buildReleaseHygieneReport(buildRepo());
  expect(negative.exitCode).toBe(0);

  const positive = buildReleaseHygieneReport(
    buildRepo({
      files: {
        "docs/PUBLIC_RELEASE.md":
          "Use npm run delivery:ready:check. AgentCore OS is production ready.",
      },
    }),
  );

  expect(positive.exitCode).toBe(1);
  expect(positive.report.checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "public_release_docs",
        ok: false,
        positiveProductionClaims: ["docs/PUBLIC_RELEASE.md"],
      }),
    ]),
  );
});

it("reports secret pattern matches as warnings without failing the gate", () => {
  const result = buildReleaseHygieneReport(
    buildRepo({
      files: {
        "src/example.ts": "const token = process.env.EXAMPLE_TOKEN;",
      },
      trackedFiles: [...Object.keys(buildFiles()), "src/example.ts"],
    }),
  );

  expect(result.exitCode).toBe(0);
  expect(result.report.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "secret_pattern_review",
        ok: false,
        matchCount: 2,
        files: [expect.objectContaining({ path: "src/example.ts" })],
      }),
    ]),
  );
});
```

- [ ] Run:

```bash
npm test -- src/__tests__/scripts/release-hygiene-check-script.test.ts
```

Expected: fail because `scripts/release-hygiene/check-release-hygiene.mjs` does not exist yet.

## Task 2: Implement Release Hygiene Script

- [ ] Create `scripts/release-hygiene/check-release-hygiene.mjs`.

- [ ] Add constants:

```js
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RELEASE_HYGIENE_COMMAND = "release:hygiene:check";

export const REQUIRED_PUBLIC_DOCS = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/PRIVACY.md",
  "docs/LICENSE_CHANGE_NOTICE.md",
];

export const BLOCKED_TRACKED_PATH_PREFIXES = [
  "node_modules/",
  ".next/",
  ".next-dev/",
  ".webhook-connector/",
  "dist/",
  "build/",
  ".openclaw-data/",
];

export const PUBLIC_RELEASE_DOCS = [
  "README.md",
  "docs/PUBLIC_RELEASE.md",
  "docs/PUBLIC_RELEASE.zh-CN.md",
  "docs/OPEN_SOURCE_CHECKLIST.md",
];

export const SECRET_REVIEW_PATTERNS = [
  "apiKey",
  "token",
  "Authorization",
  "Bearer",
  "secret",
  "password",
];
```

- [ ] Add real repository readers:

```js
export function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "git ls-files failed");
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function readRepositoryTextFile(path) {
  return readFileSync(path, "utf8");
}

export function buildRealRepositorySource() {
  return {
    trackedFiles: listTrackedFiles(),
    readTextFile: readRepositoryTextFile,
  };
}
```

- [ ] Add check helpers:

```js
function readOptional(repo, path) {
  try {
    const value = repo.readTextFile(path);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function evaluateRequiredDocs(repo) {
  const missing = REQUIRED_PUBLIC_DOCS.filter((path) => readOptional(repo, path) === undefined);
  return {
    name: "required_docs",
    ok: missing.length === 0,
    required: REQUIRED_PUBLIC_DOCS,
    ...(missing.length > 0 ? { missing } : {}),
  };
}

function evaluatePackageLicense(repo) {
  const raw = readOptional(repo, "package.json");
  if (raw === undefined) {
    return { name: "package_license", ok: false, error: "package.json is missing" };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      name: "package_license",
      ok: parsed.license === "GPL-3.0-or-later",
      expected: "GPL-3.0-or-later",
      actual: parsed.license ?? null,
    };
  } catch {
    return { name: "package_license", ok: false, error: "package.json is not valid JSON" };
  }
}

function evaluateTrackedArtifacts(repo) {
  const blockedFiles = repo.trackedFiles.filter((file) =>
    BLOCKED_TRACKED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  return {
    name: "tracked_artifact_paths",
    ok: blockedFiles.length === 0,
    blockedPrefixes: BLOCKED_TRACKED_PATH_PREFIXES,
    ...(blockedFiles.length > 0 ? { blockedFiles } : {}),
  };
}
```

- [ ] Add public wording helpers:

```js
function splitSentences(text) {
  return String(text)
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasAllowedNegativeProductionBoundary(sentence) {
  const lower = sentence.toLowerCase();
  return (
    lower.includes("not production ready") ||
    lower.includes("production readiness is not claimed") ||
    lower.includes("not claim production readiness") ||
    lower.includes("does not claim production readiness") ||
    lower.includes("outside the current release claim") ||
    lower.includes("outside the current release boundary") ||
    sentence.includes("尚未宣称 production ready") ||
    sentence.includes("不宣称 production ready") ||
    sentence.includes("生产 readiness") ||
    sentence.includes("不等于生产可用")
  );
}

function hasPositiveProductionClaim(text) {
  return splitSentences(text).some((sentence) => {
    const lower = sentence.toLowerCase();
    const hasClaim =
      lower.includes("production ready") ||
      lower.includes("production-ready") ||
      sentence.includes("生产可用") ||
      sentence.includes("生产就绪");
    return hasClaim && !hasAllowedNegativeProductionBoundary(sentence);
  });
}

function evaluatePublicReleaseDocs(repo) {
  const missingDocs = [];
  const missingDeliveryReadyCheck = [];
  const positiveProductionClaims = [];

  for (const path of PUBLIC_RELEASE_DOCS) {
    const text = readOptional(repo, path);
    if (text === undefined) {
      missingDocs.push(path);
      continue;
    }
    if (!text.includes("delivery:ready:check")) {
      missingDeliveryReadyCheck.push(path);
    }
    if (hasPositiveProductionClaim(text)) {
      positiveProductionClaims.push(path);
    }
  }

  return {
    name: "public_release_docs",
    ok:
      missingDocs.length === 0 &&
      missingDeliveryReadyCheck.length === 0 &&
      positiveProductionClaims.length === 0,
    docs: PUBLIC_RELEASE_DOCS,
    ...(missingDocs.length > 0 ? { missingDocs } : {}),
    ...(missingDeliveryReadyCheck.length > 0 ? { missingDeliveryReadyCheck } : {}),
    ...(positiveProductionClaims.length > 0 ? { positiveProductionClaims } : {}),
  };
}
```

- [ ] Add warning-only secret pattern review:

```js
function countSecretPatternMatches(text) {
  let count = 0;
  for (const pattern of SECRET_REVIEW_PATTERNS) {
    const matcher = new RegExp(pattern, "gi");
    count += Array.from(String(text).matchAll(matcher)).length;
  }
  return count;
}

function evaluateSecretPatternReview(repo) {
  const files = [];
  const skipped = [];

  for (const path of repo.trackedFiles) {
    const text = readOptional(repo, path);
    if (text === undefined) {
      skipped.push(path);
      continue;
    }
    const matches = countSecretPatternMatches(text);
    if (matches > 0) {
      files.push({ path, matches });
    }
  }

  const matchCount = files.reduce((sum, file) => sum + file.matches, 0);
  return {
    name: "secret_pattern_review",
    ok: matchCount === 0,
    severity: "warning",
    matchCount,
    files,
    ...(skipped.length > 0 ? { skipped } : {}),
  };
}
```

- [ ] Add report builder and CLI main:

```js
export function buildReleaseHygieneReport(repo = buildRealRepositorySource()) {
  const checks = [
    evaluateRequiredDocs(repo),
    evaluatePackageLicense(repo),
    evaluateTrackedArtifacts(repo),
    evaluatePublicReleaseDocs(repo),
  ];
  const warnings = [evaluateSecretPatternReview(repo)];
  const failedChecks = checks.filter((check) => !check.ok).map((check) => check.name);
  const report = {
    ok: failedChecks.length === 0,
    command: RELEASE_HYGIENE_COMMAND,
    productionReady: false,
    checks,
    warnings,
    knownLimitations: [
      "secret pattern review is warning-only and requires human review",
      "this gate checks tracked files only and does not scan git history",
      "this gate complements delivery:ready:check and does not claim production readiness",
    ],
    ...(failedChecks.length > 0 ? { failedChecks } : {}),
  };

  return {
    exitCode: failedChecks.length > 0 ? 1 : 0,
    report,
  };
}

function main() {
  const result = buildReleaseHygieneReport();
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

- [ ] Run:

```bash
npm test -- src/__tests__/scripts/release-hygiene-check-script.test.ts
```

Expected: pass.

## Task 3: Wire Package Script And Controlled Runtime Coverage

- [ ] Modify `package.json` scripts:

```json
"release:hygiene:check": "node scripts/release-hygiene/check-release-hygiene.mjs"
```

- [ ] Add the new test file to `test:controlled-runtime` after `delivery-ready-check-script.test.ts`:

```text
src/__tests__/scripts/release-hygiene-check-script.test.ts
```

- [ ] Run:

```bash
npm run release:hygiene:check
npm run test:controlled-runtime
```

Expected:

- `release:hygiene:check` exits 0 and prints JSON with `"productionReady": false`;
- `test:controlled-runtime` includes the new script coverage and exits 0.

## Task 4: Documentation And Maintenance Log

- [ ] Update `docs/OPEN_SOURCE_CHECKLIST.md`.

Add the command near the top or final verification section:

```bash
npm run release:hygiene:check
```

Explain that it checks tracked artifacts, required docs, GPLv3+ package metadata,
public release boundary wording, and warning-only secret pattern matches.

- [ ] Update `docs/PUBLIC_RELEASE.md` and `docs/PUBLIC_RELEASE.zh-CN.md`.

Add `npm run release:hygiene:check` as an open-source hygiene gate next to the
existing `delivery:ready:check` guidance, while stating that production
readiness is not claimed.

- [ ] Update `docs/NEXT_STEPS.md`.

Add a completed section for Open Source Hygiene Gate with:

- command name;
- hard checks;
- warning-only secret review;
- relationship to `delivery:ready:check`;
- updated controlled-runtime test count after verification.

- [ ] Update `CHANGELOG.md`.

Add an Unreleased bullet for `release:hygiene:check`.

- [ ] Update `memory/2026-07-06.md`.

Record spec, plan, implementation, verification, and next recommended phase.

## Task 5: Final Verification And Commit

- [ ] Run targeted verification:

```bash
npm test -- src/__tests__/scripts/release-hygiene-check-script.test.ts
npm run release:hygiene:check
```

- [ ] Run release and regression verification:

```bash
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
- `release:hygiene:check` reports `"ok": true` and `"productionReady": false`;
- secret-pattern hits, if any, remain warnings only.

- [ ] Commit:

```bash
git add scripts/release-hygiene/check-release-hygiene.mjs \
  src/__tests__/scripts/release-hygiene-check-script.test.ts \
  package.json \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  memory/2026-07-06.md \
  docs/superpowers/plans/2026-07-06-open-source-hygiene-gate.md
git commit -m "feat: add open source hygiene gate"
```

## Self-Review

- Spec coverage: every spec requirement maps to a task: tests, script, package
  script, docs, maintenance log, and final verification.
- Placeholder scan: no placeholder markers remain.
- Type consistency: the plan consistently uses
  `buildReleaseHygieneReport()`, `RELEASE_HYGIENE_COMMAND`, and
  `release:hygiene:check`.
- Scope check: the plan does not include release tagging, external systems,
  browser smoke, runtime behavior changes, or UI work.

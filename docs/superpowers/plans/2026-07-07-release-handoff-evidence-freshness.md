# Release Handoff Evidence Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only `release:handoff:evidence:check` command that verifies the newest local handoff snapshot is valid and matches the current git commit.

**Architecture:** Create one focused Node ESM CLI under `scripts/release-handoff/` that lists local snapshot JSON files, chooses the newest one, validates it through the existing snapshot validator, reads current `HEAD`, and compares commits. Keep the helper pure with injectable filesystem and git runners so tests do not depend on real `output/`.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, local JSON evidence files, git CLI.

---

## File Structure

- Create `scripts/release-handoff/check-release-handoff-evidence.mjs`
  - Exports `RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND`,
    `parseReleaseHandoffEvidenceCheckArgs(argv)`, and
    `checkReleaseHandoffEvidence(options)`.
  - Owns CLI parsing, latest snapshot selection, snapshot validation, current
    git commit lookup, freshness comparison, JSON report, and exit code.
- Create `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`
  - Covers fresh evidence, stale evidence, missing snapshot, invalid/failed
    snapshot validation, and CLI parsing.
- Modify `package.json`
  - Add `release:handoff:evidence:check`.
  - Add the new test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: Add Evidence Freshness Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
  checkReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceCheckArgs,
} from "../../../scripts/release-handoff/check-release-handoff-evidence.mjs";

const successfulSnapshot = {
  schemaVersion: 1,
  kind: "release_handoff_evidence_snapshot",
  createdAt: "2026-07-07T00:02:00.000Z",
  command: "release:handoff:snapshot",
  sourceCommand: "release:handoff:check",
  ok: true,
  releaseClaim: "local_release_handoff_ready",
  productionReady: false,
  publishingPerformed: false,
  evidenceOnly: true,
  git: {
    branch: "main",
    commit: "abcdef0",
    dirty: false,
    hasTrackedChanges: false,
    hasUntrackedFiles: false,
    statusShort: [],
  },
  handoffReport: {
    ok: true,
    command: "release:handoff:check",
    releaseClaim: "local_release_handoff_ready",
    productionReady: false,
    publishingPerformed: false,
    checks: [{ name: "build", ok: true }],
  },
};

function createMemoryFs(files: Record<string, string>) {
  return {
    listFiles: (dir: string) =>
      Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${dir}/`))
        .map((filePath) => filePath.slice(dir.length + 1)),
    readFile: (filePath: string) => files[filePath],
  };
}

describe("release handoff evidence freshness script", () => {
  it("passes when the newest snapshot validates and matches current commit", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
        snapshotPath: "output/release-handoff/latest.json",
        snapshotCommit: "abcdef0",
        currentCommit: "abcdef0",
        fresh: true,
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        releaseClaim: "local_release_handoff_ready",
        validation: {
          ok: true,
          exitCode: 0,
          snapshotOk: true,
        },
      },
    });
  });

  it("fails when the newest snapshot commit is stale", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "new2222\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        snapshotCommit: "old1111",
        currentCommit: "new2222",
        fresh: false,
        failure: "snapshot commit does not match current commit",
      },
    });
  });

  it("fails when no snapshot exists", () => {
    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        fresh: false,
        failure: "no release handoff snapshots found",
      },
    });
  });

  it("fails when newest snapshot validation is non-zero", () => {
    const failedSnapshot = {
      ...successfulSnapshot,
      ok: false,
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
      },
    };
    delete (failedSnapshot as { releaseClaim?: string }).releaseClaim;
    delete (failedSnapshot.handoffReport as { releaseClaim?: string }).releaseClaim;
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(failedSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        fresh: false,
        failure: "latest snapshot validation failed",
        validation: {
          ok: true,
          exitCode: 1,
          snapshotOk: false,
        },
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceCheckArgs(["--dir", "custom-output"]),
    ).toEqual({
      snapshotDir: "custom-output",
    });

    expect(() =>
      parseReleaseHandoffEvidenceCheckArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
  });
});
```

- [x] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-check-script.test.ts
```

Expected: fail because
`scripts/release-handoff/check-release-handoff-evidence.mjs` does not exist.

## Task 2: Implement Evidence Freshness CLI

**Files:**
- Create: `scripts/release-handoff/check-release-handoff-evidence.mjs`

- [x] **Step 1: Add the implementation**

Create `scripts/release-handoff/check-release-handoff-evidence.mjs`:

```js
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND =
  "release:handoff:evidence:check";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseReleaseHandoffEvidenceCheckArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      options.snapshotDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function listJsonSnapshotFiles(snapshotDir, listFiles) {
  try {
    return listFiles(snapshotDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => path.join(snapshotDir, fileName));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function parseSnapshot(filePath, readFile) {
  try {
    return JSON.parse(readFile(filePath));
  } catch {
    return undefined;
  }
}

function getSortTime(filePath, readFile) {
  const snapshot = parseSnapshot(filePath, readFile);
  const parsed = Date.parse(snapshot?.createdAt ?? "");
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function findNewestSnapshotPath({ snapshotDir, listFiles, readFile }) {
  const paths = listJsonSnapshotFiles(snapshotDir, listFiles);
  return paths.sort((a, b) => {
    const byCreatedAt = getSortTime(b, readFile) - getSortTime(a, readFile);
    if (byCreatedAt !== 0) return byCreatedAt;
    return b.localeCompare(a);
  })[0];
}

function runGitCommit() {
  return spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readCurrentCommit(gitRunner) {
  const result = gitRunner();
  if (result?.status !== 0) {
    const stderr = String(result?.stderr ?? "").trim();
    throw new Error(stderr || "git rev-parse failed");
  }
  const commit = String(result.stdout ?? "").trim();
  if (!commit) {
    throw new Error("git rev-parse returned an empty commit");
  }
  return commit;
}

function buildBaseReport(snapshotDir) {
  return {
    ok: false,
    command: RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
    snapshotDir,
    fresh: false,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
  };
}

function validationSummary(result) {
  return {
    ok: result.report.ok,
    exitCode: result.exitCode,
    snapshotOk: result.report.snapshotOk,
    failures: result.report.failures,
  };
}

export function checkReleaseHandoffEvidence({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner = runGitCommit,
} = {}) {
  const snapshotPath = findNewestSnapshotPath({ snapshotDir, listFiles, readFile });
  const base = buildBaseReport(snapshotDir);
  if (!snapshotPath) {
    return {
      exitCode: 1,
      report: {
        ...base,
        failure: "no release handoff snapshots found",
      },
    };
  }

  let validation;
  try {
    validation = checkReleaseHandoffSnapshotFile({ snapshotPath, readFile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: {
        ...base,
        snapshotPath,
        failure: "latest snapshot validation failed",
        validation: {
          ok: false,
          exitCode: 1,
          error: message,
        },
      },
    };
  }

  const snapshot = JSON.parse(readFile(snapshotPath));
  const snapshotCommit = snapshot?.git?.commit;
  const reportWithSnapshot = {
    ...base,
    snapshotPath,
    snapshotCommit,
    validation: validationSummary(validation),
  };

  if (validation.exitCode !== 0) {
    return {
      exitCode: 1,
      report: {
        ...reportWithSnapshot,
        failure: "latest snapshot validation failed",
      },
    };
  }

  let currentCommit;
  try {
    currentCommit = readCurrentCommit(gitRunner);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: {
        ...reportWithSnapshot,
        failure: message,
      },
    };
  }

  const fresh = snapshotCommit === currentCommit;
  const report = {
    ...reportWithSnapshot,
    ok: fresh,
    currentCommit,
    fresh,
  };

  if (fresh && snapshot.releaseClaim) {
    report.releaseClaim = snapshot.releaseClaim;
  }

  if (!fresh) {
    report.failure = "snapshot commit does not match current commit";
  }

  return {
    exitCode: fresh ? 0 : 1,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceCheckArgs(process.argv.slice(2));
  const result = checkReleaseHandoffEvidence(options);
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

- [x] **Step 2: Run the target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-check-script.test.ts
```

Expected: 5 tests pass.

## Task 3: Wire npm Script and Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add package script**

Add near the other release handoff scripts:

```json
"release:handoff:evidence:check": "node scripts/release-handoff/check-release-handoff-evidence.mjs"
```

- [x] **Step 2: Add the test to `test:controlled-runtime`**

Add this file near the other release handoff script tests:

```text
src/__tests__/scripts/release-handoff-evidence-check-script.test.ts
```

- [x] **Step 3: Run controlled runtime suite**

Run:

```bash
npm run test:controlled-runtime
```

Expected: suite passes and reports one additional file and five additional tests
compared with `47 files / 239 tests`.

## Task 4: Update Docs and Memory

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] **Step 1: Document the freshness command**

Add concise wording that:

- `npm run release:handoff:evidence:check` checks the latest existing local
  snapshot;
- it validates the snapshot and compares `snapshot.git.commit` with current
  `HEAD`;
- stale evidence should be fixed by rerunning the handoff gate and generating a
  new snapshot;
- the command is read-only;
- it does not create evidence, mutate evidence, publish, upload, tag, package
  installers, create GitHub Releases, run browser smoke, or claim production
  readiness.

- [x] **Step 2: Update baseline counts**

After verification, update `docs/NEXT_STEPS.md` and memory with exact
`test:controlled-runtime` file/test counts.

## Task 5: Final Verification, Commit, and Push

**Files:**
- All files changed by Tasks 1-4.

- [x] **Step 1: Run target test**

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-check-script.test.ts
```

- [x] **Step 2: Run the real local freshness command**

```bash
npm run release:handoff:evidence:check
```

Expected: this may fail if the newest local snapshot predates current commits.
If it fails for staleness, run:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:check
```

Do not delete old evidence.

- [x] **Step 3: Run full regression checks**

```bash
npm run test:controlled-runtime
npm run test:core-workflows
```

- [x] **Step 4: Run quality checks**

```bash
npm run lint
npm run build
git diff --check
```

Known acceptable warning:

- existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 5: Commit and push**

Stage only source, tests, docs, and the plan:

```bash
git add scripts/release-handoff/check-release-handoff-evidence.mjs \
  src/__tests__/scripts/release-handoff-evidence-check-script.test.ts \
  package.json \
  README.md \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  docs/superpowers/plans/2026-07-07-release-handoff-evidence-freshness.md
git commit -m "feat: add release handoff evidence freshness check"
git push
```

Do not stage generated files under `output/release-handoff/`.

## Self-Review

- Spec coverage: this plan covers latest snapshot selection, validator reuse,
  current commit comparison, CLI parsing, npm wiring, docs, memory, and
  verification.
- Placeholder scan: no placeholders remain.
- Type consistency: command and helper names match the spec and planned tests.
- Scope check: no UI, publishing, upload, tag, installer package, browser
  automation, evidence mutation, cleanup, or production-readiness claim is
  included.

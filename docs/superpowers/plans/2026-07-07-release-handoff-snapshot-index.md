# Release Handoff Snapshot Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only `release:handoff:snapshot:index` command for listing and optionally validating local handoff evidence snapshots.

**Architecture:** Create one focused Node ESM CLI under `scripts/release-handoff/` that lists JSON files from `output/release-handoff/`, extracts stable metadata, sorts newest first, and optionally delegates per-file validation to the existing snapshot check helper. Keep tests pure by injecting filesystem helpers and only use the real CLI for a narrow smoke-style assertion if needed.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, local JSON evidence files.

---

## File Structure

- Create `scripts/release-handoff/index-release-handoff-snapshots.mjs`
  - Exports `RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND`,
    `DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR`,
    `parseReleaseHandoffSnapshotIndexArgs(argv)`, and
    `buildReleaseHandoffSnapshotIndex(options)`.
  - Owns CLI flag parsing, directory listing, metadata extraction, optional
    validation, JSON report generation, and exit behavior.
- Create `src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts`
  - Covers sorting, limit, validation success/failure, empty directory, invalid
    JSON handling, and CLI option parsing.
- Modify `package.json`
  - Add `release:handoff:snapshot:index`.
  - Add the new test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: Add Snapshot Index Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
  buildReleaseHandoffSnapshotIndex,
  parseReleaseHandoffSnapshotIndexArgs,
} from "../../../scripts/release-handoff/index-release-handoff-snapshots.mjs";

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

const olderSnapshot = {
  ...successfulSnapshot,
  createdAt: "2026-07-07T00:01:00.000Z",
  git: { ...successfulSnapshot.git, commit: "1234567" },
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

describe("release handoff snapshot index script", () => {
  it("indexes snapshots newest first and respects limit", () => {
    const fs = createMemoryFs({
      "output/release-handoff/newer.json": JSON.stringify(successfulSnapshot),
      "output/release-handoff/older.json": JSON.stringify(olderSnapshot),
      "output/release-handoff/ignore.txt": "not a snapshot",
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      limit: 1,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
        snapshotDir: "output/release-handoff",
        count: 1,
        checked: false,
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
      },
    });
    expect(result.report.snapshots).toEqual([
      expect.objectContaining({
        path: "output/release-handoff/newer.json",
        createdAt: "2026-07-07T00:02:00.000Z",
        ok: true,
        releaseClaim: "local_release_handoff_ready",
      }),
    ]);
  });

  it("validates listed snapshots when check is enabled", () => {
    const fs = createMemoryFs({
      "output/release-handoff/newer.json": JSON.stringify(successfulSnapshot),
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.snapshots[0]).toMatchObject({
      validation: {
        ok: true,
        exitCode: 0,
        snapshotOk: true,
      },
    });
  });

  it("exits non-zero when checked snapshots include failed evidence", () => {
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
      "output/release-handoff/failed.json": JSON.stringify(failedSnapshot),
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: false,
      checked: true,
      count: 1,
    });
    expect(result.report.snapshots[0]).toMatchObject({
      ok: false,
      validation: {
        ok: true,
        exitCode: 1,
        snapshotOk: false,
      },
    });
    expect(result.report.snapshots[0]).not.toHaveProperty("releaseClaim");
  });

  it("includes invalid JSON as a failed entry when check is enabled", () => {
    const fs = createMemoryFs({
      "output/release-handoff/bad.json": "not json",
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.snapshots[0]).toMatchObject({
      path: "output/release-handoff/bad.json",
      ok: false,
      error: "snapshot file is not valid JSON",
      validation: {
        ok: false,
        exitCode: 1,
        error: "snapshot file is not valid JSON",
      },
    });
  });

  it("returns an empty successful report for a missing snapshot directory", () => {
    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      listFiles: () => {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      readFile: () => "",
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        count: 0,
        snapshots: [],
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffSnapshotIndexArgs([
        "--dir",
        "custom-output",
        "--limit",
        "5",
        "--check",
      ]),
    ).toEqual({
      snapshotDir: "custom-output",
      limit: 5,
      check: true,
    });

    expect(() =>
      parseReleaseHandoffSnapshotIndexArgs(["--limit", "0"]),
    ).toThrow("--limit must be greater than 0.");
  });
});
```

- [ ] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts
```

Expected: fail because
`scripts/release-handoff/index-release-handoff-snapshots.mjs` does not exist.

## Task 2: Implement Snapshot Index CLI

**Files:**
- Create: `scripts/release-handoff/index-release-handoff-snapshots.mjs`

- [ ] **Step 1: Add the implementation**

Create `scripts/release-handoff/index-release-handoff-snapshots.mjs`:

```js
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND =
  "release:handoff:snapshot:index";
export const DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR =
  "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${option} must be an integer.`);
  }
  if (parsed <= 0) {
    throw new Error(`${option} must be greater than 0.`);
  }
  return parsed;
}

export function parseReleaseHandoffSnapshotIndexArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR,
    limit: undefined,
    check: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      options.snapshotDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
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

function parseSnapshotJson(raw) {
  try {
    return { snapshot: JSON.parse(raw) };
  } catch {
    return { error: "snapshot file is not valid JSON" };
  }
}

function getSortTime(entry) {
  const parsed = Date.parse(entry.createdAt ?? "");
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function buildSnapshotEntry(filePath, readFile) {
  const raw = readFile(filePath);
  const parsed = parseSnapshotJson(raw);
  if (parsed.error) {
    return {
      path: filePath,
      ok: false,
      error: parsed.error,
    };
  }

  const snapshot = parsed.snapshot;
  const entry = {
    path: filePath,
    createdAt: snapshot?.createdAt,
    ok: snapshot?.ok === true,
    productionReady: snapshot?.productionReady === false ? false : snapshot?.productionReady,
    publishingPerformed:
      snapshot?.publishingPerformed === false ? false : snapshot?.publishingPerformed,
    evidenceOnly: snapshot?.evidenceOnly === true,
  };

  if (snapshot?.ok === true && snapshot.releaseClaim) {
    entry.releaseClaim = snapshot.releaseClaim;
  }

  return entry;
}

function attachValidation(entry, readFile) {
  try {
    const result = checkReleaseHandoffSnapshotFile({
      snapshotPath: entry.path,
      readFile,
    });
    return {
      ...entry,
      validation: {
        ok: result.report.ok,
        exitCode: result.exitCode,
        snapshotOk: result.report.snapshotOk,
        failures: result.report.failures,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...entry,
      ok: false,
      error: message,
      validation: {
        ok: false,
        exitCode: 1,
        error: message,
      },
    };
  }
}

function buildBaseReport({ snapshotDir, checked }) {
  return {
    ok: true,
    command: RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
    snapshotDir,
    count: 0,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    checked,
    snapshots: [],
  };
}

export function buildReleaseHandoffSnapshotIndex({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR,
  limit,
  check = false,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
} = {}) {
  const filePaths = listJsonSnapshotFiles(snapshotDir, listFiles);
  const entries = filePaths
    .map((filePath) => buildSnapshotEntry(filePath, readFile))
    .sort((a, b) => {
      const byCreatedAt = getSortTime(b) - getSortTime(a);
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.path.localeCompare(a.path);
    })
    .slice(0, limit ?? filePaths.length)
    .map((entry) => (check ? attachValidation(entry, readFile) : entry));

  const failedCheckedEntry = check
    ? entries.find((entry) => entry.validation?.exitCode !== 0)
    : undefined;
  const report = {
    ...buildBaseReport({ snapshotDir, checked: check }),
    ok: !failedCheckedEntry,
    count: entries.length,
    snapshots: entries,
  };

  return {
    exitCode: failedCheckedEntry ? 1 : 0,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffSnapshotIndexArgs(process.argv.slice(2));
  const result = buildReleaseHandoffSnapshotIndex(options);
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

- [ ] **Step 2: Run the target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts
```

Expected: 6 tests pass.

## Task 3: Wire npm Script and Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add package script**

Add near the other release handoff scripts:

```json
"release:handoff:snapshot:index": "node scripts/release-handoff/index-release-handoff-snapshots.mjs"
```

- [ ] **Step 2: Add the test to `test:controlled-runtime`**

Add this file near the other release handoff script tests:

```text
src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts
```

- [ ] **Step 3: Run controlled runtime suite**

Run:

```bash
npm run test:controlled-runtime
```

Expected: suite passes and reports one additional file and six additional tests
compared with `46 files / 233 tests`.

## Task 4: Update Docs and Memory

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Document the index command**

Add concise wording that:

- `npm run release:handoff:snapshot:index` lists local evidence snapshots;
- `--check` validates the listed snapshots using the existing validator;
- `--limit <n>` narrows the review set;
- the command is read-only;
- it does not create evidence, mutate evidence, publish, upload, tag, package
  installers, create GitHub Releases, run browser smoke, or claim production
  readiness.

- [ ] **Step 2: Update baseline counts**

After verification, update `docs/NEXT_STEPS.md` and memory with exact
`test:controlled-runtime` file/test counts.

## Task 5: Final Verification, Commit, and Push

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run target test**

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts
```

- [ ] **Step 2: Run the real local index command**

```bash
npm run release:handoff:snapshot:index -- --check --limit 5
```

Expected: command reads local `output/release-handoff/` evidence, prints JSON,
and exits `0` when the listed snapshots validate successfully. If old local
failed evidence is present, either narrow `--limit` to the latest successful
snapshot or record the non-zero evidence state without deleting evidence.

- [ ] **Step 3: Run full regression checks**

```bash
npm run test:controlled-runtime
npm run test:core-workflows
```

- [ ] **Step 4: Run quality checks**

```bash
npm run lint
npm run build
git diff --check
```

Known acceptable warning:

- existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [ ] **Step 5: Commit and push**

Stage only source, tests, docs, and the plan:

```bash
git add scripts/release-handoff/index-release-handoff-snapshots.mjs \
  src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts \
  package.json \
  README.md \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  docs/superpowers/plans/2026-07-07-release-handoff-snapshot-index.md
git commit -m "feat: add release handoff snapshot index"
git push
```

Do not stage generated files under `output/release-handoff/`.

## Self-Review

- Spec coverage: this plan covers index command, CLI flags, read-only behavior,
  optional validation, npm wiring, docs, memory, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: command and helper names match the spec and planned tests.
- Scope check: no UI, publishing, upload, tag, installer package, browser
  automation, evidence mutation, cleanup, or production-readiness claim is
  included.

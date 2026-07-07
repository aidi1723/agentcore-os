# Release Handoff Evidence Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only `release:handoff:evidence:status` command that aggregates latest evidence doctor output and checked recent snapshot index output into one handoff evidence status report.

**Architecture:** Create one focused Node ESM CLI under `scripts/release-handoff/` that calls existing helper functions instead of spawning npm commands. The script combines `doctorReleaseHandoffEvidence()` and `buildReleaseHandoffSnapshotIndex({ check: true })`, derives `readyForLocalHandoffEvidence`, forwards next-command guidance, and preserves the release boundary fields.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, local JSON evidence files.

---

## File Structure

- Create `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`
  - Covers fresh/ready, stale doctor, failed index, no snapshots, and CLI parsing.
- Create `scripts/release-handoff/status-release-handoff-evidence.mjs`
  - Exports `RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND`,
    `parseReleaseHandoffEvidenceStatusArgs(argv)`, and
    `buildReleaseHandoffEvidenceStatus(options)`.
  - Owns CLI parsing, helper composition, status derivation, JSON report, and exit code.
- Modify `package.json`
  - Add `release:handoff:evidence:status`.
  - Add the new test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: Add Status Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
  buildReleaseHandoffEvidenceStatus,
  parseReleaseHandoffEvidenceStatusArgs,
} from "../../../scripts/release-handoff/status-release-handoff-evidence.mjs";

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

describe("release handoff evidence status script", () => {
  it("reports ready when doctor is fresh and checked index passes", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      limit: 5,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
        snapshotDir: "output/release-handoff",
        limit: 5,
        readyForLocalHandoffEvidence: true,
        nextCommand: "npm run release:handoff:evidence:check",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        doctor: {
          exitCode: 0,
          status: "fresh_evidence",
          snapshotPath: "output/release-handoff/latest.json",
        },
        index: {
          exitCode: 0,
          count: 1,
          checked: true,
        },
      },
    });
  });

  it("reports not ready and forwards doctor guidance when latest evidence is stale", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "new2222\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot",
        doctor: {
          exitCode: 1,
          status: "stale_evidence",
        },
        index: {
          exitCode: 0,
          count: 1,
          checked: true,
        },
      },
    });
  });

  it("reports not ready and recommends index review when recent checked snapshots fail", () => {
    const invalidOlderSnapshot = {
      ...successfulSnapshot,
      createdAt: "2026-07-07T00:01:00.000Z",
      kind: "wrong_kind",
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
      "output/release-handoff/older.json": JSON.stringify(invalidOlderSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      limit: 5,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot:index -- --check --limit 5",
        doctor: {
          exitCode: 0,
          status: "fresh_evidence",
        },
        index: {
          exitCode: 1,
          count: 2,
          checked: true,
        },
      },
    });
  });

  it("reports not ready when no snapshots exist", () => {
    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot",
        doctor: {
          exitCode: 1,
          status: "missing_evidence",
        },
        index: {
          exitCode: 0,
          count: 0,
          checked: true,
        },
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceStatusArgs([
        "--dir",
        "custom-output",
        "--limit",
        "3",
      ]),
    ).toEqual({
      snapshotDir: "custom-output",
      limit: 3,
    });

    expect(() =>
      parseReleaseHandoffEvidenceStatusArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
    expect(() =>
      parseReleaseHandoffEvidenceStatusArgs(["--limit", "0"]),
    ).toThrow("--limit must be greater than 0.");
  });
});
```

- [ ] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

Expected: fail because
`scripts/release-handoff/status-release-handoff-evidence.mjs` does not exist.

## Task 2: Implement Evidence Status CLI

**Files:**
- Create: `scripts/release-handoff/status-release-handoff-evidence.mjs`

- [ ] **Step 1: Add the implementation**

Create `scripts/release-handoff/status-release-handoff-evidence.mjs` with:

```js
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  doctorReleaseHandoffEvidence,
} from "./doctor-release-handoff-evidence.mjs";
import {
  buildReleaseHandoffSnapshotIndex,
} from "./index-release-handoff-snapshots.mjs";

export const RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND =
  "release:handoff:evidence:status";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";
const DEFAULT_STATUS_LIMIT = 5;

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${option} must be an integer.`);
  if (parsed <= 0) throw new Error(`${option} must be greater than 0.`);
  return parsed;
}

export function parseReleaseHandoffEvidenceStatusArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
    limit: DEFAULT_STATUS_LIMIT,
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
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function compactDoctor(result) {
  const report = result.report;
  return {
    exitCode: result.exitCode,
    ok: report.ok,
    status: report.status,
    severity: report.severity,
    snapshotPath: report.snapshotPath,
    snapshotCommit: report.snapshotCommit,
    currentCommit: report.currentCommit,
    nextCommand: report.nextCommand,
    nextAction: report.nextAction,
    validation: report.validation,
  };
}

function compactIndex(result) {
  const report = result.report;
  return {
    exitCode: result.exitCode,
    ok: report.ok,
    count: report.count,
    checked: report.checked,
    snapshots: report.snapshots,
  };
}

function buildIndexReviewCommand(limit) {
  return `npm run release:handoff:snapshot:index -- --check --limit ${limit}`;
}

export function buildReleaseHandoffEvidenceStatus({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  limit = DEFAULT_STATUS_LIMIT,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner,
} = {}) {
  const doctorResult = doctorReleaseHandoffEvidence({
    snapshotDir,
    listFiles,
    readFile,
    ...(gitRunner ? { gitRunner } : {}),
  });
  const indexResult = buildReleaseHandoffSnapshotIndex({
    snapshotDir,
    limit,
    check: true,
    listFiles,
    readFile,
  });

  const doctorReady =
    doctorResult.exitCode === 0 &&
    doctorResult.report.status === "fresh_evidence";
  const indexReady =
    indexResult.exitCode === 0 && indexResult.report.count > 0;
  const readyForLocalHandoffEvidence = doctorReady && indexReady;
  const indexReviewNeeded = doctorReady && !indexReady;

  const nextCommand = indexReviewNeeded
    ? buildIndexReviewCommand(limit)
    : doctorResult.report.nextCommand;
  const nextAction = indexReviewNeeded
    ? "Recent handoff evidence index validation failed; inspect the checked snapshot index before using local evidence for handoff."
    : doctorResult.report.nextAction;

  const report = {
    ok: readyForLocalHandoffEvidence,
    command: RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
    snapshotDir,
    limit,
    readyForLocalHandoffEvidence,
    nextCommand,
    nextAction,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    doctor: compactDoctor(doctorResult),
    index: compactIndex(indexResult),
  };

  return {
    exitCode: readyForLocalHandoffEvidence ? 0 : 1,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceStatusArgs(process.argv.slice(2));
  const result = buildReleaseHandoffEvidenceStatus(options);
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

- [ ] **Step 2: Run target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

Expected: all status tests pass.

## Task 3: Wire Package Script And Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add npm script**

Add after `release:handoff:evidence:doctor`:

```json
"release:handoff:evidence:status": "node scripts/release-handoff/status-release-handoff-evidence.mjs"
```

- [ ] **Step 2: Add target test to controlled runtime suite**

Append this test path near the other release handoff tests:

```text
src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

- [ ] **Step 3: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: all controlled runtime tests pass.

## Task 4: Update Docs And Memory

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Document command usage**

Add `npm run release:handoff:evidence:status` beside the existing handoff
evidence commands.

- [ ] **Step 2: Document boundary**

State that the status command aggregates existing doctor and index checks, but
does not run the full handoff gate, generate snapshots, mutate evidence,
publish, upload, tag, package installers, create GitHub Releases, run browser
smoke, or claim production readiness.

- [ ] **Step 3: Record the phase**

Add a `Release Handoff Evidence Status started` entry to
`memory/2026-07-07.md` with TDD evidence, behavior, docs updated, and final
verification.

## Task 5: Final Verification And Commit

**Files:**
- Review all changed files.

- [ ] **Step 1: Run targeted test**

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

- [ ] **Step 2: Run real local status command**

```bash
npm run release:handoff:evidence:status
```

Expected after the latest local snapshot: `readyForLocalHandoffEvidence: true`
when recent checked snapshots all validate.

- [ ] **Step 3: Run full verification**

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit `0`; lint/build may retain the existing `<img>`
warning in `src/__tests__/components/ShellUI.test.tsx`.

- [ ] **Step 4: Commit implementation**

```bash
git add package.json README.md CHANGELOG.md docs/NEXT_STEPS.md docs/OPEN_SOURCE_CHECKLIST.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md memory/2026-07-07.md scripts/release-handoff/status-release-handoff-evidence.mjs src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
git commit -m "feat: add release handoff evidence status"
```

- [ ] **Step 5: Refresh evidence after commit**

Run:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:status
npm run release:handoff:evidence:check
```

Expected: the refreshed local-only snapshot under `output/release-handoff/`
matches the implementation commit, the status command reports
`readyForLocalHandoffEvidence: true`, and the freshness gate exits `0`.

- [ ] **Step 6: Push**

```bash
git push
```

Do not stage `output/` evidence snapshots or unrelated untracked local files.

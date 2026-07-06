# Release Handoff Evidence Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only `release:handoff:evidence:doctor` command that diagnoses the latest local handoff evidence state and recommends the next local command.

**Architecture:** Create one focused Node ESM CLI under `scripts/release-handoff/` that lists local snapshot JSON files, chooses the newest one, validates it through the existing snapshot validator, compares snapshot commit to current `HEAD`, and maps the result to an operator-facing status. Keep the helper pure with injectable filesystem and git runners so tests do not depend on real `output/`.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, local JSON evidence files, git CLI.

---

## File Structure

- Create `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`
  - Covers fresh, missing, invalid, failed, stale, and argument parsing states.
- Create `scripts/release-handoff/doctor-release-handoff-evidence.mjs`
  - Exports `RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND`,
    `parseReleaseHandoffEvidenceDoctorArgs(argv)`, and
    `doctorReleaseHandoffEvidence(options)`.
  - Owns CLI parsing, latest snapshot selection, snapshot validation, current
    git commit lookup, diagnostic status mapping, JSON report, and exit code.
- Modify `package.json`
  - Add `release:handoff:evidence:doctor`.
  - Add the new test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: Add Doctor Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
  doctorReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceDoctorArgs,
} from "../../../scripts/release-handoff/doctor-release-handoff-evidence.mjs";

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

describe("release handoff evidence doctor script", () => {
  it("reports fresh evidence with the freshness gate as the next hard check", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
        snapshotDir: "output/release-handoff",
        status: "fresh_evidence",
        severity: "info",
        snapshotPath: "output/release-handoff/latest.json",
        snapshotCommit: "abcdef0",
        currentCommit: "abcdef0",
        nextCommand: "npm run release:handoff:evidence:check",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        releaseClaim: "local_release_handoff_ready",
      },
    });
  });

  it("reports missing evidence with snapshot creation guidance", () => {
    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "missing_evidence",
        severity: "error",
        nextCommand: "npm run release:handoff:snapshot",
      },
    });
  });

  it("reports invalid evidence when the latest snapshot is not valid JSON", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": "not json",
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "invalid_evidence",
        severity: "error",
        snapshotPath: "output/release-handoff/latest.json",
        nextCommand: "npm run release:handoff:snapshot",
        validation: {
          ok: false,
          exitCode: 1,
          error: "snapshot file is not valid JSON",
        },
      },
    });
  });

  it("reports failed evidence when the latest snapshot is structurally valid but failed", () => {
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

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "failed_evidence",
        severity: "error",
        snapshotCommit: "abcdef0",
        nextCommand: "npm run release:handoff:check",
        validation: {
          ok: true,
          exitCode: 1,
          snapshotOk: false,
        },
      },
    });
    expect(result.report).not.toHaveProperty("releaseClaim");
  });

  it("reports stale evidence when the latest snapshot commit differs from current commit", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "new2222\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "stale_evidence",
        severity: "error",
        snapshotCommit: "old1111",
        currentCommit: "new2222",
        nextCommand: "npm run release:handoff:snapshot",
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceDoctorArgs(["--dir", "custom-output"]),
    ).toEqual({
      snapshotDir: "custom-output",
    });

    expect(() =>
      parseReleaseHandoffEvidenceDoctorArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
  });
});
```

- [ ] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
```

Expected: fail because
`scripts/release-handoff/doctor-release-handoff-evidence.mjs` does not exist.

## Task 2: Implement Evidence Doctor CLI

**Files:**
- Create: `scripts/release-handoff/doctor-release-handoff-evidence.mjs`

- [ ] **Step 1: Add the implementation**

Create `scripts/release-handoff/doctor-release-handoff-evidence.mjs` with:

```js
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND =
  "release:handoff:evidence:doctor";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseReleaseHandoffEvidenceDoctorArgs(argv) {
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
  if (!commit) throw new Error("git rev-parse returned an empty commit");
  return commit;
}

function buildBaseReport(snapshotDir) {
  return {
    ok: false,
    command: RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
    snapshotDir,
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

function withStatus(report, status, severity, nextCommand, nextAction, ok = false) {
  return {
    ...report,
    ok,
    status,
    severity,
    nextCommand,
    nextAction,
  };
}

export function doctorReleaseHandoffEvidence({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner = runGitCommit,
} = {}) {
  const base = buildBaseReport(snapshotDir);
  const snapshotPath = findNewestSnapshotPath({ snapshotDir, listFiles, readFile });

  if (!snapshotPath) {
    return {
      exitCode: 1,
      report: withStatus(
        base,
        "missing_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "No local handoff evidence was found; run the handoff snapshot command after the local handoff gate passes.",
      ),
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(readFile(snapshotPath));
  } catch {
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...base,
          snapshotPath,
          validation: {
            ok: false,
            exitCode: 1,
            error: "snapshot file is not valid JSON",
          },
        },
        "invalid_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence is not valid JSON; regenerate local handoff evidence after the handoff gate passes.",
      ),
    };
  }

  let validation;
  try {
    validation = checkReleaseHandoffSnapshotFile({ snapshotPath, readFile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...base,
          snapshotPath,
          snapshotCommit: snapshot?.git?.commit,
          validation: {
            ok: false,
            exitCode: 1,
            error: message,
          },
        },
        "invalid_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence could not be validated; regenerate local handoff evidence after the handoff gate passes.",
      ),
    };
  }

  const reportWithSnapshot = {
    ...base,
    snapshotPath,
    snapshotCommit: snapshot?.git?.commit,
    validation: validationSummary(validation),
  };

  if (validation.exitCode !== 0) {
    return {
      exitCode: 1,
      report: withStatus(
        reportWithSnapshot,
        "failed_evidence",
        "error",
        "npm run release:handoff:check",
        "Latest evidence records a failed handoff gate; rerun the local handoff gate and fix the first failing check.",
      ),
    };
  }

  let currentCommit;
  try {
    currentCommit = readCurrentCommit(gitRunner);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...reportWithSnapshot,
          failure: message,
        },
        "git_unavailable",
        "error",
        "git rev-parse --short HEAD",
        "Current git commit could not be read; fix git access before checking evidence freshness.",
      ),
    };
  }

  const fresh = snapshot?.git?.commit === currentCommit;
  if (!fresh) {
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...reportWithSnapshot,
          currentCommit,
        },
        "stale_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence is stale for the current commit; rerun the handoff snapshot after the local handoff gate passes.",
      ),
    };
  }

  const report = withStatus(
    {
      ...reportWithSnapshot,
      currentCommit,
    },
    "fresh_evidence",
    "info",
    "npm run release:handoff:evidence:check",
    "Fresh local handoff evidence is available; run the freshness gate when a hard pass/fail check is needed.",
    true,
  );

  if (snapshot.releaseClaim) {
    report.releaseClaim = snapshot.releaseClaim;
  }

  return {
    exitCode: 0,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceDoctorArgs(process.argv.slice(2));
  const result = doctorReleaseHandoffEvidence(options);
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
npm test -- src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
```

Expected: all doctor tests pass.

## Task 3: Wire Package Script And Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add npm script**

Add to `scripts` after `release:handoff:evidence:check`:

```json
"release:handoff:evidence:doctor": "node scripts/release-handoff/doctor-release-handoff-evidence.mjs"
```

- [ ] **Step 2: Add target test to controlled runtime suite**

Append this test path to `test:controlled-runtime` near the other release
handoff script tests:

```text
src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
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

Add `npm run release:handoff:evidence:doctor` beside the existing handoff
evidence commands.

- [ ] **Step 2: Document boundary**

State that the doctor is read-only, suggests the next command, and does not
create evidence, publish, upload, tag, package installers, create GitHub
Releases, run browser smoke, or claim production readiness.

- [ ] **Step 3: Document current phase record**

Add a dated `Release Handoff Evidence Doctor started` entry to
`memory/2026-07-07.md` with TDD evidence and expected final verification lines.

## Task 5: Final Verification And Commit

**Files:**
- Review all changed files.

- [ ] **Step 1: Run targeted test**

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
```

- [ ] **Step 2: Run real local doctor command**

```bash
npm run release:handoff:evidence:doctor
```

Expected before a new post-commit snapshot: may report `stale_evidence` because
the previous evidence snapshot was created before this implementation commit.
That is acceptable and should be recorded truthfully.

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
git add package.json README.md CHANGELOG.md docs/NEXT_STEPS.md docs/OPEN_SOURCE_CHECKLIST.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md memory/2026-07-07.md scripts/release-handoff/doctor-release-handoff-evidence.mjs src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
git commit -m "feat: add release handoff evidence doctor"
```

- [ ] **Step 5: Refresh evidence after commit**

Run:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:doctor
npm run release:handoff:evidence:check
```

Expected: the refreshed local-only snapshot under `output/release-handoff/`
matches the new implementation commit, the doctor reports `fresh_evidence`, and
the freshness gate exits `0`.

- [ ] **Step 6: Push**

```bash
git push
```

Do not stage `output/` evidence snapshots or unrelated untracked local files.

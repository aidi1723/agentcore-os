# Release Handoff Evidence Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run release:handoff:snapshot`, a local-only evidence command that writes the latest release handoff gate result and git context into `output/release-handoff/`.

**Architecture:** Keep the existing `release:handoff:check` gate as the source of truth. Add a separate snapshot writer that runs the gate, parses its JSON, collects git context, writes one timestamped local JSON evidence file, and prints a compact JSON summary. Tests use dependency injection for the child runner, git commands, and file writer so they do not run the full build.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, git CLI context, local filesystem output.

---

## File Structure

- Create `scripts/release-handoff/write-release-handoff-snapshot.mjs`
  - Exports `buildReleaseHandoffEvidenceSnapshot(...)`,
    `writeReleaseHandoffSnapshot(...)`, `parseGitStatusSummary(...)`, and
    constants for command names.
  - Owns child command execution, JSON parsing, git context collection, snapshot
    file naming, and CLI exit behavior.
- Create `src/__tests__/scripts/release-handoff-snapshot-script.test.ts`
  - Tests snapshot generation, failed-gate preservation, invalid JSON failure,
    git status parsing, and boundary flags.
- Modify `package.json`
  - Add `release:handoff:snapshot`.
  - Add the new test file to `test:controlled-runtime`.
- Modify docs and logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`
- Do not stage generated files under `output/release-handoff/`.

## Task 1: Add Snapshot Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-snapshot-script.test.ts`
- Read: `scripts/release-handoff/check-release-handoff.mjs`

- [x] **Step 1: Write the failing test file**

Create `src/__tests__/scripts/release-handoff-snapshot-script.test.ts` with tests shaped like:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_COMMAND,
  buildReleaseHandoffEvidenceSnapshot,
  parseGitStatusSummary,
  writeReleaseHandoffSnapshot,
} from "../../../scripts/release-handoff/write-release-handoff-snapshot.mjs";

const passingReport = {
  ok: true,
  command: "release:handoff:check",
  releaseClaim: "local_release_handoff_ready",
  productionReady: false,
  publishingPerformed: false,
  checks: [{ name: "release_hygiene_check", ok: true, exitCode: 0 }],
};

describe("release handoff snapshot script", () => {
  it("writes a local evidence snapshot for a passing handoff report", () => {
    const writes: Array<{ path: string; data: string }> = [];
    const result = writeReleaseHandoffSnapshot({
      now: () => new Date("2026-07-07T00:00:00.000Z"),
      outputDir: "output/release-handoff",
      handoffRunner: () => ({
        status: 0,
        stdout: JSON.stringify(passingReport),
        stderr: "",
      }),
      gitRunner: (name) => {
        if (name === "branch") return { status: 0, stdout: "main\n", stderr: "" };
        if (name === "commit") return { status: 0, stdout: "abcdef0\n", stderr: "" };
        return { status: 0, stdout: "?? output/\n", stderr: "" };
      },
      writeFile: (path, data) => writes.push({ path, data }),
      mkdir: () => undefined,
    });

    expect(result.exitCode).toBe(0);
    expect(result.summary).toMatchObject({
      ok: true,
      command: RELEASE_HANDOFF_SNAPSHOT_COMMAND,
      snapshotPath:
        "output/release-handoff/release-handoff-2026-07-07T000000000Z.json",
      releaseClaim: "local_release_handoff_ready",
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
    expect(writes).toHaveLength(1);
    const snapshot = JSON.parse(writes[0].data);
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      kind: "release_handoff_evidence_snapshot",
      ok: true,
      releaseClaim: "local_release_handoff_ready",
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      git: {
        branch: "main",
        commit: "abcdef0",
        dirty: true,
        hasTrackedChanges: false,
        hasUntrackedFiles: true,
      },
      handoffReport: passingReport,
    });
  });

  it("writes failed handoff evidence but exits non-zero without a release claim", () => {
    const writes: Array<{ path: string; data: string }> = [];
    const failedReport = {
      ok: false,
      command: "release:handoff:check",
      productionReady: false,
      publishingPerformed: false,
      failedCheck: "build",
      checks: [{ name: "build", ok: false, exitCode: 1 }],
    };

    const result = writeReleaseHandoffSnapshot({
      now: () => new Date("2026-07-07T00:01:00.000Z"),
      outputDir: "output/release-handoff",
      handoffRunner: () => ({
        status: 1,
        stdout: JSON.stringify(failedReport),
        stderr: "build failed",
      }),
      gitRunner: () => ({ status: 0, stdout: "", stderr: "" }),
      writeFile: (path, data) => writes.push({ path, data }),
      mkdir: () => undefined,
    });

    expect(result.exitCode).toBe(1);
    expect(result.summary).not.toHaveProperty("releaseClaim");
    expect(JSON.parse(writes[0].data)).toMatchObject({
      ok: false,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      handoffReport: failedReport,
    });
  });

  it("fails invalid handoff JSON without writing an incomplete snapshot", () => {
    const writes: Array<{ path: string; data: string }> = [];

    expect(() =>
      writeReleaseHandoffSnapshot({
        handoffRunner: () => ({ status: 0, stdout: "not json", stderr: "" }),
        gitRunner: () => ({ status: 0, stdout: "", stderr: "" }),
        writeFile: (path, data) => writes.push({ path, data }),
        mkdir: () => undefined,
      }),
    ).toThrow("release:handoff:check did not return valid JSON");
    expect(writes).toEqual([]);
  });

  it("parses tracked and untracked git status separately", () => {
    expect(parseGitStatusSummary([" M README.md", "A  src/new.ts", "?? output/"])).toEqual({
      dirty: true,
      hasTrackedChanges: true,
      hasUntrackedFiles: true,
    });
  });

  it("builds snapshots with local-only release boundaries", () => {
    const snapshot = buildReleaseHandoffEvidenceSnapshot({
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
      handoffReport: passingReport,
      git: {
        branch: "main",
        commit: "abcdef0",
        dirty: false,
        hasTrackedChanges: false,
        hasUntrackedFiles: false,
        statusShort: [],
      },
    });

    expect(snapshot).toMatchObject({
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
  });
});
```

- [x] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts
```

Expected: fail because `scripts/release-handoff/write-release-handoff-snapshot.mjs` does not exist yet.

## Task 2: Implement Snapshot Writer

**Files:**
- Create: `scripts/release-handoff/write-release-handoff-snapshot.mjs`

- [ ] **Step 1: Add the minimal implementation**

Create `scripts/release-handoff/write-release-handoff-snapshot.mjs` with:

```js
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_SNAPSHOT_COMMAND = "release:handoff:snapshot";
export const RELEASE_HANDOFF_SOURCE_COMMAND = "release:handoff:check";
export const DEFAULT_RELEASE_HANDOFF_SNAPSHOT_OUTPUT_DIR =
  "output/release-handoff";

export function parseGitStatusSummary(statusShort) {
  const lines = statusShort.map((line) => String(line)).filter(Boolean);
  return {
    dirty: lines.length > 0,
    hasTrackedChanges: lines.some((line) => !line.startsWith("??")),
    hasUntrackedFiles: lines.some((line) => line.startsWith("??")),
  };
}

export function buildReleaseHandoffEvidenceSnapshot({
  createdAt,
  handoffReport,
  git,
}) {
  const ok = handoffReport?.ok === true;
  const snapshot = {
    schemaVersion: 1,
    kind: "release_handoff_evidence_snapshot",
    createdAt: createdAt.toISOString(),
    command: RELEASE_HANDOFF_SNAPSHOT_COMMAND,
    sourceCommand: RELEASE_HANDOFF_SOURCE_COMMAND,
    ok,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    git,
    handoffReport,
    knownWarnings: [
      "snapshot is local evidence only and is not a published release artifact",
      "output/release-handoff snapshots should not be committed by default",
    ],
  };

  if (ok && handoffReport.releaseClaim) {
    snapshot.releaseClaim = handoffReport.releaseClaim;
  }

  return snapshot;
}
```

Then add helpers for running commands, parsing JSON, sanitizing timestamps,
collecting git context, writing files, and CLI `main()`.

- [ ] **Step 2: Run the target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts
```

Expected: all tests in the file pass.

## Task 3: Wire npm Scripts and Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add package script**

Add:

```json
"release:handoff:snapshot": "node scripts/release-handoff/write-release-handoff-snapshot.mjs"
```

near the existing release handoff scripts.

- [ ] **Step 2: Add the new test file to `test:controlled-runtime`**

Append:

```text
src/__tests__/scripts/release-handoff-snapshot-script.test.ts
```

after `src/__tests__/scripts/release-handoff-check-script.test.ts`.

- [ ] **Step 3: Verify target and suite inclusion**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts
npm run test:controlled-runtime
```

Expected: target test passes; controlled runtime suite includes the new test.

## Task 4: Update Documentation and Local Memory

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Document the new command**

Add concise wording that:

- `npm run release:handoff:snapshot` writes local evidence under
  `output/release-handoff/`;
- generated evidence is not committed by default;
- the command preserves `productionReady: false`, `publishingPerformed: false`,
  and `evidenceOnly: true`;
- it does not publish, tag, upload, package installers, or create releases.

- [ ] **Step 2: Update current baseline counts after verification**

If `test:controlled-runtime` reports a changed file/test count, update
`docs/NEXT_STEPS.md` and `memory/2026-07-07.md` with the exact values from the
fresh run.

## Task 5: Final Verification, Commit, and Push

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run target verification**

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts
```

- [ ] **Step 2: Run the real snapshot command**

```bash
npm run release:handoff:snapshot
```

Expected:

- exits `0` when `release:handoff:check` passes;
- prints JSON with a `snapshotPath`;
- writes one file under `output/release-handoff/`;
- generated output remains unstaged.

- [ ] **Step 3: Run the full local handoff gate**

```bash
npm run release:handoff:check
```

Expected: exits `0` and reports `local_release_handoff_ready`,
`productionReady: false`, and `publishingPerformed: false`.

- [ ] **Step 4: Run regression and quality commands**

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- tests pass;
- lint/build may retain the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`;
- `git diff --check` exits `0`.

- [ ] **Step 5: Review diff and avoid staging local evidence**

Run:

```bash
git status --short
git diff --stat
```

Stage only source/docs/test files for this phase. Do not stage
`output/release-handoff/`.

- [ ] **Step 6: Commit and push**

```bash
git add scripts/release-handoff/write-release-handoff-snapshot.mjs \
  src/__tests__/scripts/release-handoff-snapshot-script.test.ts \
  package.json \
  README.md \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  docs/superpowers/plans/2026-07-07-release-handoff-evidence-snapshot.md
git commit -m "feat: add release handoff evidence snapshot"
git push
```

`memory/2026-07-07.md` is gitignored local continuity; update it but do not
stage it unless repository policy changes.

## Self-Review

- Spec coverage: the plan covers command creation, snapshot JSON, failed gate
  preservation, invalid JSON failure, git context, docs, verification, and
  local-only evidence boundary.
- Placeholder scan: no placeholders remain.
- Type consistency: exported function and constant names are consistent across
  the test and implementation tasks.
- Scope check: this plan does not add UI, browser automation, publishing,
  tagging, upload, installer packaging, real replay, or runtime behavior.

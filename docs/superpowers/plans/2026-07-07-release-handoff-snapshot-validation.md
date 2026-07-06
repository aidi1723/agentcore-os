# Release Handoff Snapshot Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only command that validates release handoff evidence snapshots for schema and release-boundary correctness.

**Architecture:** Implement a focused Node ESM validator script that reads one JSON snapshot path, validates stable rules, prints a JSON validation report, and exits non-zero for invalid snapshots or structurally valid failed handoff evidence. Tests inject snapshot objects directly for rule coverage and do not run the full handoff gate.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, local JSON files.

---

## File Structure

- Create `scripts/release-handoff/check-release-handoff-snapshot.mjs`
  - Exports `RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND`,
    `validateReleaseHandoffSnapshot(snapshot, snapshotPath)`, and
    `checkReleaseHandoffSnapshotFile(...)`.
  - Owns rule validation, file reading, JSON parsing, stdout report, and CLI
    exit behavior.
- Create `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`
  - Covers successful snapshot, failed evidence snapshot, boundary violations,
    and invalid JSON.
- Modify `package.json`
  - Add `release:handoff:snapshot:check`.
  - Add the test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: Add Snapshot Check Tests First

**Files:**
- Create: `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND,
  checkReleaseHandoffSnapshotFile,
  validateReleaseHandoffSnapshot,
} from "../../../scripts/release-handoff/check-release-handoff-snapshot.mjs";

const successfulSnapshot = {
  schemaVersion: 1,
  kind: "release_handoff_evidence_snapshot",
  createdAt: "2026-07-07T00:00:00.000Z",
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
    dirty: true,
    hasTrackedChanges: false,
    hasUntrackedFiles: true,
    statusShort: ["?? output/"],
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

describe("release handoff snapshot check script", () => {
  it("passes a valid successful handoff snapshot", () => {
    const result = validateReleaseHandoffSnapshot(
      successfulSnapshot,
      "output/release-handoff/example.json",
    );

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND,
        snapshotPath: "output/release-handoff/example.json",
        snapshotOk: true,
        releaseClaim: "local_release_handoff_ready",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
      },
    });
    expect(result.report.checkedRules).toEqual([
      "top_level_shape",
      "git_context_shape",
      "handoff_report_shape",
      "release_boundary",
    ]);
  });

  it("validates failed handoff evidence but exits non-zero without a release claim", () => {
    const failedSnapshot = {
      ...successfulSnapshot,
      ok: false,
      releaseClaim: undefined,
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
        releaseClaim: undefined,
        failedCheck: "build",
      },
    };
    delete failedSnapshot.releaseClaim;
    delete failedSnapshot.handoffReport.releaseClaim;

    const result = validateReleaseHandoffSnapshot(failedSnapshot, "failed.json");

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: true,
      snapshotOk: false,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
    expect(result.report).not.toHaveProperty("releaseClaim");
  });

  it("fails snapshots that omit the production boundary", () => {
    const invalid = { ...successfulSnapshot, productionReady: true };
    const result = validateReleaseHandoffSnapshot(invalid, "bad.json");

    expect(result.exitCode).toBe(1);
    expect(result.report.ok).toBe(false);
    expect(result.report.failures).toContain("productionReady must be false");
  });

  it("fails failed snapshots that expose a release claim", () => {
    const invalid = {
      ...successfulSnapshot,
      ok: false,
      releaseClaim: "local_release_handoff_ready",
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
      },
    };
    const result = validateReleaseHandoffSnapshot(invalid, "bad-failed.json");

    expect(result.exitCode).toBe(1);
    expect(result.report.failures).toContain(
      "failed snapshots must not include releaseClaim",
    );
  });

  it("fails invalid JSON without pretending validation ran", () => {
    expect(() =>
      checkReleaseHandoffSnapshotFile({
        snapshotPath: "invalid.json",
        readFile: () => "not json",
      }),
    ).toThrow("snapshot file is not valid JSON");
  });
});
```

- [ ] **Step 2: Run the target test and confirm RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
```

Expected: fail because `scripts/release-handoff/check-release-handoff-snapshot.mjs`
does not exist.

## Task 2: Implement Snapshot Validator

**Files:**
- Create: `scripts/release-handoff/check-release-handoff-snapshot.mjs`

- [ ] **Step 1: Add validation helpers and CLI**

Create `scripts/release-handoff/check-release-handoff-snapshot.mjs` with:

```js
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND =
  "release:handoff:snapshot:check";
export const CHECKED_RELEASE_HANDOFF_SNAPSHOT_RULES = [
  "top_level_shape",
  "git_context_shape",
  "handoff_report_shape",
  "release_boundary",
];
```

Implement:

- `validateReleaseHandoffSnapshot(snapshot, snapshotPath)`
- `checkReleaseHandoffSnapshotFile({ snapshotPath, readFile })`
- `main()`

Validation should gather `failures` in a string array and return:

```js
{
  exitCode,
  report
}
```

For structurally valid failed snapshots, return `report.ok: true`,
`report.snapshotOk: false`, and `exitCode: 1`.

- [ ] **Step 2: Run the target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
```

Expected: 5 tests pass.

## Task 3: Wire npm Scripts and Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add package script**

Add near existing release handoff scripts:

```json
"release:handoff:snapshot:check": "node scripts/release-handoff/check-release-handoff-snapshot.mjs"
```

- [ ] **Step 2: Add test to `test:controlled-runtime`**

Add:

```text
src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
```

near the other release handoff script tests.

- [ ] **Step 3: Run controlled runtime suite**

Run:

```bash
npm run test:controlled-runtime
```

Expected: suite passes and reports one additional file and five additional
tests compared with `45 files / 228 tests`.

## Task 4: Update Docs and Memory

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Document the validator**

Add concise wording that:

- `npm run release:handoff:snapshot:check -- <snapshot.json>` validates a local
  evidence file;
- it is read-only;
- it checks schema and release boundary;
- it does not publish, upload, tag, package installers, or modify evidence.

- [ ] **Step 2: Update baseline counts**

After verification, update `docs/NEXT_STEPS.md` and memory with exact
`test:controlled-runtime` file/test counts.

## Task 5: Final Verification, Commit, and Push

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run target test**

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
```

- [ ] **Step 2: Generate and validate a real snapshot**

```bash
npm run release:handoff:snapshot
npm run release:handoff:snapshot:check -- <generated-snapshot-path>
```

Use the `snapshotPath` from the previous command output.

- [ ] **Step 3: Run full handoff and regression checks**

```bash
npm run release:handoff:check
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
git add scripts/release-handoff/check-release-handoff-snapshot.mjs \
  src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts \
  package.json \
  README.md \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  docs/superpowers/plans/2026-07-07-release-handoff-snapshot-validation.md
git commit -m "feat: add release handoff snapshot validation"
git push
```

Do not stage generated files under `output/release-handoff/`.

## Self-Review

- Spec coverage: this plan covers validator command, validation rules, CLI,
  tests, npm wiring, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: command and function names match the planned test imports.
- Scope check: no UI, publishing, upload, tag, installer package, browser
  automation, or evidence mutation is included.

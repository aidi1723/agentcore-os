# Release Handoff Evidence Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only cross-snapshot audit command for local release handoff evidence.

**Architecture:** Build a new `audit-release-handoff-evidence.mjs` helper that reuses `buildReleaseHandoffSnapshotIndex({ check: true })` and adds summary/findings/next-command logic. Keep snapshot validation centralized in the existing validator and keep the command local-only with explicit release boundaries.

**Tech Stack:** Node.js ESM scripts, npm scripts, Vitest, JSON evidence files under `output/release-handoff/`.

---

## File Structure

- Create `scripts/release-handoff/audit-release-handoff-evidence.mjs`: read-only audit command and exported helper.
- Create `src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts`: RED/GREEN coverage for audit behavior and CLI args.
- Modify `package.json`: add `release:handoff:evidence:audit` and include audit test in `test:controlled-runtime`.
- Modify docs after implementation:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: RED Audit Command Tests

**Files:**
- Create: `src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts`

- [ ] **Step 1: Add test fixtures and imports**

Create the test file with:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND,
  auditReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceAuditArgs,
} from "../../../scripts/release-handoff/audit-release-handoff-evidence.mjs";

const fullCommit = "abcdef0123456789abcdef0123456789abcdef01";

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
    commitFull: fullCommit,
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
```

- [ ] **Step 2: Test passing audit**

Add:

```ts
it("passes when recent checked snapshots are successful and full-SHA covered", () => {
  const fs = createMemoryFs({
    "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
  });

  const result = auditReleaseHandoffEvidence({
    snapshotDir: "output/release-handoff",
    limit: 10,
    listFiles: fs.listFiles,
    readFile: fs.readFile,
  });

  expect(result).toMatchObject({
    exitCode: 0,
    report: {
      ok: true,
      command: RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND,
      snapshotDir: "output/release-handoff",
      limit: 10,
      count: 1,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      nextCommand: "npm run release:handoff:evidence:status",
      summary: {
        total: 1,
        successful: 1,
        failedEvidence: 0,
        invalidEvidence: 0,
        invalidJson: 0,
        withFullCommit: 1,
        missingFullCommit: 0,
      },
      latestSnapshot: {
        path: "output/release-handoff/latest.json",
        ok: true,
        hasFullCommit: true,
      },
      findings: [],
    },
  });
});
```

- [ ] **Step 3: Test empty audit failure**

Add a missing directory test. Expected finding:

```ts
{
  code: "no_snapshots",
  severity: "error",
  count: 0,
}
```

Expected `nextCommand`: `npm run release:handoff:snapshot`.

- [ ] **Step 4: Test failed evidence finding**

Create a structurally valid failed snapshot by setting snapshot `ok: false`, handoff report `ok: false`, and deleting both release claims. Assert:

```ts
exitCode: 1,
report: {
  ok: false,
  summary: { failedEvidence: 1 },
  findings: [expect.objectContaining({ code: "failed_evidence", count: 1 })],
}
```

- [ ] **Step 5: Test invalid JSON and schema-invalid findings**

Add one test with `"not json"` and assert `invalid_json`.

Add one test with `kind: "wrong_kind"` and assert `invalid_evidence`.

- [ ] **Step 6: Test missing full commit evidence**

Use a successful old short-only snapshot:

```ts
const shortOnlySnapshot = {
  ...successfulSnapshot,
  git: {
    ...successfulSnapshot.git,
    commitFull: undefined,
  },
};
delete (shortOnlySnapshot.git as { commitFull?: string }).commitFull;
```

Assert `missing_full_commit_evidence`, exit code `1`, and `nextCommand: "npm run release:handoff:snapshot"`.

- [ ] **Step 7: Test CLI args**

Assert:

```ts
expect(parseReleaseHandoffEvidenceAuditArgs(["--dir", "custom", "--limit", "3"])).toEqual({
  snapshotDir: "custom",
  limit: 3,
});
expect(() => parseReleaseHandoffEvidenceAuditArgs(["--limit", "0"])).toThrow(
  "--limit must be greater than 0.",
);
expect(() => parseReleaseHandoffEvidenceAuditArgs(["--unknown"])).toThrow(
  "Unknown option: --unknown",
);
```

- [ ] **Step 8: Run RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts
```

Expected: fail because `scripts/release-handoff/audit-release-handoff-evidence.mjs` does not exist.

## Task 2: GREEN Audit Command

**Files:**
- Create: `scripts/release-handoff/audit-release-handoff-evidence.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement CLI parser and constants**

Create `scripts/release-handoff/audit-release-handoff-evidence.mjs` with:

```js
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildReleaseHandoffSnapshotIndex } from "./index-release-handoff-snapshots.mjs";

export const RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND =
  "release:handoff:evidence:audit";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";
const DEFAULT_AUDIT_LIMIT = 10;
```

Implement `readOptionValue`, `parsePositiveInteger`, and `parseReleaseHandoffEvidenceAuditArgs()` following the style in `status-release-handoff-evidence.mjs`.

- [ ] **Step 2: Implement JSON helpers**

Add:

```js
function parseSnapshot(raw) {
  try {
    return { snapshot: JSON.parse(raw) };
  } catch {
    return { error: "snapshot file is not valid JSON" };
  }
}

function hasFullCommitEvidence(snapshot) {
  return (
    typeof snapshot?.git?.commitFull === "string" &&
    snapshot.git.commitFull.length > 0
  );
}
```

- [ ] **Step 3: Classify entries**

Add `classifyEntry(entry)`:

```js
function classifyEntry(entry) {
  if (entry.validation?.error === "snapshot file is not valid JSON") {
    return "invalid_json";
  }
  if (entry.validation?.ok === true && entry.validation?.snapshotOk === false) {
    return "failed_evidence";
  }
  if (entry.validation?.exitCode !== 0) {
    return "invalid_evidence";
  }
  if (entry.ok === true) return "success";
  return "invalid_evidence";
}
```

- [ ] **Step 4: Build audited entries**

For each checked index snapshot, read and parse the JSON again only to determine `hasFullCommit`. Preserve invalid JSON entries.

Each audited entry should include:

```js
{
  path,
  createdAt,
  ok,
  releaseClaim,
  classification,
  hasFullCommit,
  validation,
}
```

- [ ] **Step 5: Build summary and findings**

Summary fields:

```js
{
  total,
  successful,
  failedEvidence,
  invalidEvidence,
  invalidJson,
  withFullCommit,
  missingFullCommit,
}
```

Findings:

```js
function finding(code, count, paths, severity = "error") {
  return { code, severity, count, ...(paths.length > 0 ? { paths } : {}) };
}
```

Emit findings for no snapshots, checked index failure, latest not successful, failed evidence, invalid evidence, invalid JSON, and missing full commit evidence.

- [ ] **Step 6: Build report and exit code**

`ok` is true only when there is at least one snapshot, index passes, latest is successful, and `missingFullCommit === 0`.

Next command:

```js
function chooseNextCommand({ ok, count, indexOk, latestSuccessful, missingFullCommit, limit }) {
  if (ok) return "npm run release:handoff:evidence:status";
  if (count === 0 || !latestSuccessful || missingFullCommit > 0) {
    return "npm run release:handoff:snapshot";
  }
  if (!indexOk) {
    return `npm run release:handoff:snapshot:index -- --check --limit ${limit}`;
  }
  return "npm run release:handoff:snapshot";
}
```

Add matching `nextAction` text.

- [ ] **Step 7: Add main()**

Follow existing script pattern:

```js
function main() {
  const options = parseReleaseHandoffEvidenceAuditArgs(process.argv.slice(2));
  const result = auditReleaseHandoffEvidence(options);
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
  process.exitCode = result.exitCode;
}
```

- [ ] **Step 8: Add npm scripts**

In `package.json`, add:

```json
"release:handoff:evidence:audit": "node scripts/release-handoff/audit-release-handoff-evidence.mjs"
```

Add `src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts` to `test:controlled-runtime` near the other release handoff tests.

- [ ] **Step 9: Run GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts
```

Expected: all audit tests pass.

## Task 3: Documentation, Memory, And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Update docs**

Document `npm run release:handoff:evidence:audit` as a read-only cross-snapshot audit command. Explain that it summarizes recent evidence health, checks full commit coverage for successful snapshots, recommends existing local commands, and does not publish or mutate evidence.

- [ ] **Step 2: Run verification**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit `0`; the known `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may remain.

- [ ] **Step 3: Commit implementation**

Stage only tracked project files and the new audit files:

```bash
git add scripts/release-handoff/audit-release-handoff-evidence.mjs src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts package.json README.md CHANGELOG.md docs/NEXT_STEPS.md docs/OPEN_SOURCE_CHECKLIST.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md
git commit -m "feat: add release handoff evidence audit"
```

Do not stage `output/` or local identity/heartbeat files.

- [ ] **Step 4: Refresh local-only evidence and audit**

Run:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:audit
npm run release:handoff:evidence:status
npm run release:handoff:evidence:check
```

If the audit fails because older recent snapshots are missing `commitFull`, run the audit with a smaller current-window limit:

```bash
npm run release:handoff:evidence:audit -- --limit 1
```

Record the result clearly. Do not mutate old evidence in place and do not stage `output/`.

- [ ] **Step 5: Push**

Run:

```bash
git push
```

Expected: `main` and `origin/main` align.

## Rollback Notes

If the audit proves too strict for local handoff workflows, revert the implementation commit. The existing snapshot, check, doctor, status, and index commands remain independent and usable without the audit command.

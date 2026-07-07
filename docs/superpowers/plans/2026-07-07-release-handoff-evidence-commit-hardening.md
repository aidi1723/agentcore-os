# Release Handoff Evidence Commit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New release handoff evidence records a full git commit SHA and freshness checks prefer full-SHA comparison while old short-only snapshots remain readable.

**Architecture:** Extend the existing release-handoff script chain in place. The snapshot writer adds `git.commitFull`; the snapshot validator treats it as optional-but-validated; freshness and doctor checks share the same full-first commit comparison shape; status passes the richer doctor fields through.

**Tech Stack:** Node.js ESM scripts, Vitest, npm scripts, JSON release handoff evidence files.

---

## File Structure

- Modify `scripts/release-handoff/write-release-handoff-snapshot.mjs`: collect full commit context and write it into new snapshots.
- Modify `scripts/release-handoff/check-release-handoff-snapshot.mjs`: validate optional `git.commitFull`.
- Modify `scripts/release-handoff/check-release-handoff-evidence.mjs`: read current full SHA and compare full-first with short fallback.
- Modify `scripts/release-handoff/doctor-release-handoff-evidence.mjs`: use the same full-first comparison behavior and report full commit fields.
- Modify `scripts/release-handoff/status-release-handoff-evidence.mjs`: include full commit fields in compact doctor output.
- Modify `src/__tests__/scripts/release-handoff-snapshot-script.test.ts`: assert new snapshots include `git.commitFull`.
- Modify `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`: assert old snapshots pass and invalid present `commitFull` fails.
- Modify `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`: assert full match, old fallback, and full mismatch behavior.
- Modify `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`: assert full match and full mismatch behavior.
- Modify `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`: assert compact doctor includes full commit fields.
- Modify docs and memory after behavior is green:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/OPEN_SOURCE_CHECKLIST.md`
  - `docs/PUBLIC_RELEASE.md`
  - `docs/PUBLIC_RELEASE.zh-CN.md`
  - `memory/2026-07-07.md`

## Task 1: RED Tests For Full Commit Evidence

**Files:**
- Modify: `src/__tests__/scripts/release-handoff-snapshot-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`
- Modify: `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`

- [ ] **Step 1: Update snapshot writer test**

Add a full SHA constant and make the writer fixture return it for `commitFull`:

```ts
const fullCommit = "abcdef0123456789abcdef0123456789abcdef01";

gitRunner: (name: string) => {
  if (name === "branch") return { status: 0, stdout: "main\n", stderr: "" };
  if (name === "commit") return { status: 0, stdout: "abcdef0\n", stderr: "" };
  if (name === "commitFull") {
    return { status: 0, stdout: `${fullCommit}\n`, stderr: "" };
  }
  return { status: 0, stdout: "?? output/\n", stderr: "" };
},
```

Assert the written snapshot includes:

```ts
git: {
  branch: "main",
  commit: "abcdef0",
  commitFull: fullCommit,
  dirty: true,
  hasTrackedChanges: false,
  hasUntrackedFiles: true,
},
```

- [ ] **Step 2: Update snapshot validation tests**

Keep the existing `successfulSnapshot` old-shape fixture without `commitFull` so compatibility stays covered. Add a new test:

```ts
it("validates git.commitFull when present", () => {
  const invalid = {
    ...successfulSnapshot,
    git: { ...successfulSnapshot.git, commitFull: 123 },
  };

  const result = validateReleaseHandoffSnapshot(invalid, "bad-full.json");

  expect(result.exitCode).toBe(1);
  expect(result.report.failures).toContain(
    "git.commitFull must be a string when present",
  );
});
```

- [ ] **Step 3: Update freshness tests**

Add:

```ts
const fullCommit = "abcdef0123456789abcdef0123456789abcdef01";
```

Add a passing full-SHA test where snapshot has `git.commitFull: fullCommit` and `gitRunner` returns the same full SHA. Assert `snapshotCommitFull` and `currentCommitFull`.

Add a fallback test where snapshot omits `commitFull`, current git returns `abcdef0123456789abcdef0123456789abcdef01`, and the existing short `abcdef0` still passes.

Add a mismatch test where `git.commit` is `abcdef0`, `git.commitFull` is `abcdef0000000000000000000000000000000000`, and current full SHA is `abcdef0123456789abcdef0123456789abcdef01`. Assert exit code `1`, `fresh: false`, and `failure: "snapshot commit does not match current commit"`.

- [ ] **Step 4: Update doctor tests**

Add full-SHA fresh and stale cases mirroring the freshness script. Assert fresh reports include `snapshotCommitFull` and `currentCommitFull`; stale reports must fail when full SHA mismatches even if short SHA matches.

- [ ] **Step 5: Update status test**

Use a snapshot with `git.commitFull` in the ready test and assert:

```ts
doctor: {
  snapshotCommit: "abcdef0",
  snapshotCommitFull: fullCommit,
  currentCommit: "abcdef0",
  currentCommitFull: fullCommit,
}
```

- [ ] **Step 6: Run RED**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

Expected: fail because production scripts do not yet collect, validate, compare, or report `commitFull`.

## Task 2: GREEN Implementation

**Files:**
- Modify: `scripts/release-handoff/write-release-handoff-snapshot.mjs`
- Modify: `scripts/release-handoff/check-release-handoff-snapshot.mjs`
- Modify: `scripts/release-handoff/check-release-handoff-evidence.mjs`
- Modify: `scripts/release-handoff/doctor-release-handoff-evidence.mjs`
- Modify: `scripts/release-handoff/status-release-handoff-evidence.mjs`

- [ ] **Step 1: Add full commit collection**

In `runGitContextCommand`, add:

```js
commitFull: ["git", ["rev-parse", "HEAD"]],
```

In `collectGitContext`, read:

```js
const commitFull = requireSuccessfulResult(
  gitRunner("commitFull"),
  "git full commit",
);
```

Return:

```js
commit: commit.trim(),
commitFull: commitFull.trim(),
```

- [ ] **Step 2: Validate optional commitFull**

In `validateGitShape`, add:

```js
pushIf(
  failures,
  hasOwn(git, "commitFull") && typeof git.commitFull !== "string",
  "git.commitFull must be a string when present",
);
```

- [ ] **Step 3: Add full current commit reading and comparison helper in freshness script**

Change the git runner command to `git rev-parse HEAD`.

Add:

```js
function shortCommit(fullCommit, length = 7) {
  return String(fullCommit ?? "").slice(0, length);
}

function buildCommitComparison({ snapshot, currentCommitFull }) {
  const snapshotCommit = snapshot?.git?.commit;
  const snapshotCommitFull = snapshot?.git?.commitFull;
  const currentCommit = shortCommit(
    currentCommitFull,
    String(snapshotCommit ?? "").length || 7,
  );
  const usesFullCommit = typeof snapshotCommitFull === "string" && snapshotCommitFull.length > 0;
  const fresh = usesFullCommit
    ? snapshotCommitFull === currentCommitFull
    : snapshotCommit === currentCommit;

  return {
    fresh,
    snapshotCommit,
    snapshotCommitFull,
    currentCommit,
    currentCommitFull,
    usesFullCommit,
  };
}
```

Use the returned fields in `reportWithSnapshot` and final reports.

- [ ] **Step 4: Apply same comparison behavior in doctor script**

Mirror the `shortCommit()` and `buildCommitComparison()` helpers in `doctor-release-handoff-evidence.mjs`, then use `comparison.fresh` instead of `snapshot.git.commit === currentCommit`.

- [ ] **Step 5: Include full fields in status compact doctor output**

Add these fields to `compactDoctor()`:

```js
snapshotCommitFull: report.snapshotCommitFull,
currentCommitFull: report.currentCommitFull,
```

- [ ] **Step 6: Run GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

Expected: all targeted tests pass.

## Task 3: Documentation, Memory, And Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Update docs**

Document that new snapshots now include full SHA evidence and freshness/doctor/status use full-first matching with short-only fallback for old snapshots. Keep every release boundary explicit: no production readiness, no publishing, no uploads, no tags, no installers, no GitHub Releases.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit `0`; the known `<img>` lint/build warning in `src/__tests__/components/ShellUI.test.tsx` may remain.

- [ ] **Step 3: Commit implementation**

Stage only tracked project files for this phase, not `output/` or local identity files:

```bash
git add scripts/release-handoff/write-release-handoff-snapshot.mjs scripts/release-handoff/check-release-handoff-snapshot.mjs scripts/release-handoff/check-release-handoff-evidence.mjs scripts/release-handoff/doctor-release-handoff-evidence.mjs scripts/release-handoff/status-release-handoff-evidence.mjs src/__tests__/scripts/release-handoff-snapshot-script.test.ts src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-evidence-status-script.test.ts README.md CHANGELOG.md docs/NEXT_STEPS.md docs/OPEN_SOURCE_CHECKLIST.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md memory/2026-07-07.md
git commit -m "feat: harden release handoff commit evidence"
```

- [ ] **Step 4: Refresh local-only evidence after commit**

Run:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:status
npm run release:handoff:evidence:check
```

Expected: status/check report fresh local evidence for the implementation commit, with full commit fields present where surfaced. Do not stage `output/`.

- [ ] **Step 5: Push**

Run:

```bash
git push
```

Expected: `main` and `origin/main` align.

## Rollback Notes

If the hardening causes false stale evidence, revert the implementation commit. Old snapshots remain schema-compatible because `git.commitFull` is optional and schema version remains `1`.

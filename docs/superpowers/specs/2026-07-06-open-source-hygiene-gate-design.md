# Open Source Hygiene Gate Design

Date: 2026-07-06

## Context

The project has aligned its public release boundary around AgentCore OS as a
local-first Controlled Skill / Playbook Runtime. The current allowed public
claim is `local_delivery_demo_ready`, and production readiness remains outside
the current release boundary.

The open-source checklist is still mostly manual. Maintainers can inspect it,
but there is no local read-only command that confirms the repository still has
the required public docs, GPLv3+ package metadata, no tracked build/private
artifacts, and no accidental production-ready wording in public release docs.

This phase should convert the repeatable parts of the checklist into a local
JSON gate without expanding runtime behavior.

## Goal

Add a local open-source hygiene command:

```bash
npm run release:hygiene:check
```

The command should print a machine-readable JSON report that answers:

- are required public governance documents present;
- is `package.json` licensed as `GPL-3.0-or-later`;
- are blocked build/private artifact paths absent from tracked git files;
- do public release docs reference `delivery:ready:check`;
- do public release docs avoid positive production-readiness claims;
- were secret-scan warning patterns observed for human review.

The command should be usable before a public handoff or release sanity pass.

## Non-Goals

- No file mutation.
- No dev server startup.
- No browser automation.
- No external network access.
- No GitHub API calls.
- No tag, release, package, installer, or archive creation.
- No git history rewrite or deep history secret audit.
- No proof that the repository contains no secrets.
- No production readiness claim.
- No runtime, playbook, replay, fixture, trace retention, or UI behavior change.

## Approach

The recommended approach is a small Node ESM script with exported helpers and
an injectable repository inspection layer for tests.

Rejected alternatives:

- Shell-only checklist: simple but harder to test and less portable inside the
  existing Vitest workflow.
- Extending `delivery:ready:check`: mixes delivery-demo runtime readiness with
  repository presentation hygiene. Keeping a separate gate makes each command's
  claim clearer.

## Command Contract

Script path:

```text
scripts/release-hygiene/check-release-hygiene.mjs
```

Package script:

```json
"release:hygiene:check": "node scripts/release-hygiene/check-release-hygiene.mjs"
```

The command is read-only. It may read:

- tracked file list through `git ls-files`;
- selected repository files from disk;
- selected public release documents;
- tracked text file contents for warning-oriented pattern scanning.

The command must not write files.

## Hard Checks

The gate should fail when any hard check fails.

### Required Documents

Required files:

- `LICENSE`
- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `docs/PRIVACY.md`
- `docs/LICENSE_CHANGE_NOTICE.md`

### License Metadata

`package.json` must contain:

```json
{
  "license": "GPL-3.0-or-later"
}
```

Malformed `package.json` is a hard failure.

### Tracked Artifact Paths

No tracked file should live under:

- `node_modules/`
- `.next/`
- `.next-dev/`
- `.webhook-connector/`
- `dist/`
- `build/`
- `.openclaw-data/`

The first implementation checks tracked files only. Untracked local files are
not a hard failure because local workspace context can exist outside the public
repository state.

### Public Release Boundary Docs

The following public-facing docs must mention `delivery:ready:check`:

- `README.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

The same docs must not contain positive production-ready claims. The gate should
allow negative boundary language such as:

- `production readiness is not claimed`
- `not production ready`
- `尚未宣称 production ready`

The gate should only reject obvious positive claim phrases, for example:

- `production ready`
- `production-ready`
- `生产可用`
- `生产就绪`

when they are not within an explicitly negative or out-of-scope sentence.

## Warning Checks

Secret scanning should be warning-oriented only. It should not fail the gate in
this phase because the repository contains legitimate words such as `token`,
`secret`, or `Authorization` in source code, documentation, tests, and examples.

The warning scan should report tracked text-file matches for review using these
case-insensitive terms:

- `apiKey`
- `token`
- `Authorization`
- `Bearer`
- `secret`
- `password`

The report should include file paths and match counts, not full line contents.
This avoids leaking potentially sensitive text into logs while still directing
maintainers to the review surface.

## Output Contract

On success, stdout should be JSON:

```json
{
  "ok": true,
  "command": "release:hygiene:check",
  "productionReady": false,
  "checks": [
    {
      "name": "required_docs",
      "ok": true
    }
  ],
  "warnings": [
    {
      "name": "secret_pattern_review",
      "ok": true,
      "matchCount": 0,
      "files": []
    }
  ],
  "knownLimitations": [
    "secret pattern review is warning-only and requires human review"
  ]
}
```

On failure:

- stdout still prints JSON;
- `ok` is `false`;
- failed hard checks include structured diagnostics;
- process exit code is `1`;
- `productionReady` remains `false`.

Unexpected top-level script errors may print to stderr and exit non-zero.

## Error Handling

The gate should fail closed when:

- `git ls-files` cannot run;
- a required file is missing;
- `package.json` cannot be parsed;
- license metadata is not `GPL-3.0-or-later`;
- tracked blocked artifact paths are found;
- public docs miss `delivery:ready:check`;
- public docs include positive production-ready wording.

Warning scans should tolerate unreadable binary-like files by skipping files
that cannot be decoded as UTF-8 text and reporting the skip as a warning detail.

## Documentation Updates

Update:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-06.md`

Docs must say clearly:

- `release:hygiene:check` is a local read-only repository hygiene gate;
- it complements but does not replace `delivery:ready:check`;
- secret pattern review is warning-only and still needs human review;
- production readiness remains outside the current release claim.

## Testing

Add `src/__tests__/scripts/release-hygiene-check-script.test.ts`.

Coverage:

- returns success JSON when required docs, GPLv3+ metadata, artifact checks, and
  release docs pass;
- fails when a required document is missing;
- fails when `package.json` license is not `GPL-3.0-or-later`;
- fails when tracked blocked artifact paths are present;
- fails when public docs do not mention `delivery:ready:check`;
- fails on positive production-ready wording while allowing negative boundary
  wording;
- reports secret pattern matches as warnings without failing the gate.

Tests should import exported helpers and inject repository data instead of
running real git commands.

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/release-hygiene-check-script.test.ts
npm run release:hygiene:check
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
- `release:hygiene:check` outputs JSON with `"ok": true` and
  `"productionReady": false`;
- secret-pattern hits, if any, appear only under warnings.

## Spec Self-Review

- Placeholder scan: no placeholder requirements remain.
- Internal consistency: command, non-goals, hard checks, warning checks, output,
  tests, and docs all describe the same local read-only gate.
- Scope check: this is one implementation slice and does not bundle release
  tagging, browser smoke, installer packaging, or production hardening.
- Ambiguity check: tracked artifacts are hard failures; secret-pattern matches
  are warning-only; untracked local workspace files are outside the hard gate.

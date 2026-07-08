# GitHub macOS CLI Install Path Implementation Plan

**Goal:** Make GitHub macOS command-line installation the only current public install format and add a local check to keep that documentation contract stable.

## Task 1: Install Path Checker

Files:

- Create `scripts/release-hygiene/check-github-macos-cli-install.mjs`
- Create `src/__tests__/scripts/github-macos-cli-install-check-script.test.ts`
- Modify `package.json`

Steps:

- [x] Write failing tests for the missing checker.
- [x] Implement a pure read-only checker that validates required docs, canonical commands, scope boundary, and entry doc alignment.
- [x] Add `npm run release:github-macos-cli:check`.
- [x] Add the checker test to `test:controlled-runtime`.

## Task 2: Canonical Install Docs

Files:

- Create `docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md`
- Modify `docs/COMMAND_LINE_INSTALL.zh-CN.md`
- Modify `README.md`
- Modify `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`

Steps:

- [x] Add the canonical GitHub macOS command-line install page.
- [x] Redirect old command-line install docs to the canonical page.
- [x] Update public entry docs to link to `docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md`.
- [x] Keep historical docs intact where they are not current install entry points.

## Task 3: Handoff Integration And Records

Files:

- Modify `scripts/release-handoff/check-release-handoff.mjs`
- Modify `src/__tests__/scripts/release-handoff-check-script.test.ts`
- Modify `CHANGELOG.md`
- Modify `docs/NEXT_STEPS.md`
- Modify `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify `memory/2026-07-08.md`

Steps:

- [x] Add the install check to `release:handoff:check`.
- [x] Update handoff tests for the new check order.
- [x] Record the phase in changelog, backlog, checklist, and local memory.

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/github-macos-cli-install-check-script.test.ts src/__tests__/scripts/release-handoff-check-script.test.ts
npm run release:github-macos-cli:check
npm run release:handoff:check
npm run test:controlled-runtime
git diff --check
```

Expected:

- install checker reports `installClaim: "github_macos_cli_install_path_defined"`;
- handoff checker includes `github_macos_cli_install_check`;
- all checks keep `productionReady: false` and `publishingPerformed: false`;
- no clone, install, service start, package build, tag, upload, deployment, external write, credential use, or production verification is performed by the checker.

# Releasing

## Versioning

This repo uses semantic-ish tags: `vMAJOR.MINOR.PATCH`.

Current public recommendation:

- release line: `v1.1.1`
- current maintenance notes:
  - `docs/releases/v1.1.1.md`
  - `docs/releases/v1.1.1.zh-CN.md`
  - `docs/releases/2026-03-25-desktop-parity-update.zh-CN.md`

## Create a release (local)

```bash
npm run desktop:smoke-test-sidecar
npm run test:core-workflows
npm run lint
npm run build

git status
git commit -am "chore: prep release" # if needed
git tag -a v1.1.1 -m "v1.1.1"
git push origin main --tags
```

## Desktop package checks

Before claiming a desktop build is ready, run:

```bash
npm run desktop:build-doctor
npm run runtime:doctor
npm run desktop:prepare-sidecar
npm run desktop:smoke-test-sidecar
```

For a local desktop package:

```bash
npm run desktop:package
```

Expected Windows installer output:

- `src-tauri/target/release/bundle/nsis/*.exe`

Expected macOS app output:

- `src-tauri/target/release/bundle/macos/*.app`
- `src-tauri/target/release/bundle/dmg/*.dmg`

## Create a GitHub Release

On GitHub:
- Releases → Draft a new release
- Choose tag (e.g. `v1.1.1`)
- Use `docs/releases/v1.1.1.md` as the release body

For Chinese-facing mirrors or release notes, keep these in sync:

- `docs/releases/v1.1.1.zh-CN.md`
- `docs/releases/v1.1.1-github-release.zh-CN.md`
- `docs/releases/2026-03-25-desktop-parity-update.zh-CN.md`

Optional:
- Enable “Auto-generate release notes” (configured by `.github/release.yml`)
- Or trigger `Windows Desktop Package` to produce a Windows NSIS installer artifact

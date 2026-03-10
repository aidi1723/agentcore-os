# Releasing

## Versioning

This repo uses semantic-ish tags: `vMAJOR.MINOR.PATCH`.

## Create a release (local)

```bash
npm run lint
npm run build

git status
git commit -am "chore: prep release" # if needed
git tag -a v0.1.0 -m "v0.1.0"
git push origin main --tags
```

## Create a GitHub Release

On GitHub:
- Releases → Draft a new release
- Choose tag (e.g. `v0.1.0`)
- Use `docs/releases/v0.1.0.md` as the release body

Optional:
- Enable “Auto-generate release notes” (configured by `.github/release.yml`)


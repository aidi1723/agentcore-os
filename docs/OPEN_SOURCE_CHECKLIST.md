# Open Source Checklist

Use this before publishing the repository.

## 1) Remove build artifacts

Ensure these are not committed:
- `node_modules/`
- `.next/`
- `.next-dev/`
- `.webhook-connector/`

## 2) Scan for secrets and identifiers

Recommended commands:

```bash
rg -n "apiKey|token|Authorization|Bearer|secret|password" -g '!node_modules/**' -g '!.next/**' .
rg -n "email|phone|address|company|domain" -g '!node_modules/**' -g '!.next/**' .
```

If you ever committed secrets, you must rewrite git history before pushing.

## 3) Verify license + docs

- `LICENSE`
- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

## 4) GitHub repo settings

- Enable Issues + Discussions (optional)
- Add branch protection on `main` (optional)
- Configure Dependabot (optional)

## 5) Final local verification

```bash
npm run lint
npm run build
```


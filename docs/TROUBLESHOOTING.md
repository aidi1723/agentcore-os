# Troubleshooting

## “Cannot connect” / blank page

- Ensure `npm run dev` is running
- Open `http://localhost:3000/`

## Connector shows “offline”

- Ensure `npm run webhook:dev` is running
- Open `http://127.0.0.1:8787/health`

## OpenClaw routes fail

Some API routes call an external CLI (`openclaw`). If it is not installed or not available in PATH:
- Features will fall back where possible
- Otherwise you may see “OpenClaw unavailable” style errors

## Reset local demo data

Clear browser localStorage keys:
- `openclaw.settings.v1`
- `openclaw.drafts.v1`
- `openclaw.publish.v1`
- `openclaw.vault.v1`


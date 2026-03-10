# Configuration

## Settings storage

The app stores settings in browser localStorage:

- Key: `openclaw.settings.v1`

This includes:
- LLM provider config (API key/base URL/model)
- Engine base URL/token
- Publishing connector tokens and webhook URLs
- UI personalization (wallpaper)

## Reset settings

In your browser devtools:
- Application → Local Storage → delete `openclaw.settings.v1`

## Connector webhooks

For “auto publish” dispatch:

1) Run the example connector: `npm run webhook:dev`
2) In Settings → Accounts/Publishing set `Publish Webhook URL` to:
   `http://127.0.0.1:8787/webhook/publish`

For production, replace with your own connector endpoint.


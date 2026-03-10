# Connectors (Bring Your Own)

This project intentionally keeps “auto publish” as a **connector problem**:

- The UI prepares platform variants and a publish payload
- The server optionally dispatches to your connector webhook
- Your connector implements real posting via **official APIs** or approved services

## Webhook contract

Endpoint (example):

`POST https://your-connector.example.com/webhook/publish`

Payload (JSON):

```json
{
  "platform": "xiaohongshu",
  "title": "…",
  "body": "…",
  "hashtags": ["#tag1", "#tag2"],
  "token": "optional",
  "dryRun": false
}
```

Response:

```json
{ "ok": true, "id": "…" }
```

## Local example connector

This repo includes a small local server:

- `scripts/webhook-connector/server.mjs`
- Run with `npm run webhook:dev`
- UI at `http://127.0.0.1:8787/`

It only logs receipts — it does not post anywhere.

## Recommended real-world options

- Official platform APIs (preferred)
- Approved third-party schedulers (Buffer/Metricool/Make/Zapier)
- Internal tooling with explicit user consent and ToS compliance


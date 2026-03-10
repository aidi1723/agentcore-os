# OpenClaw OS Webhook Connector (Example)

This is a minimal **bring-your-own-connector** webhook server.

Use it to turn WebOS "矩阵发布中心" into **one-click auto publish** by pointing each platform's
`Publish Webhook URL` to this server.

Important:
- This example does **not** post to any real social media.
- Implementing real posting must follow each platform's ToS and use official APIs / approved partners.

## Quick start

From repo root:

```bash
npm run webhook:dev
```

Server listens on `http://127.0.0.1:8787` by default.

Open the mini console:

`http://127.0.0.1:8787/`

### Health check

```bash
curl http://127.0.0.1:8787/health
```

### Publish webhook endpoint

Set `Publish Webhook URL` to:

`http://127.0.0.1:8787/webhook/publish`

Example payload:

```bash
curl -X POST http://127.0.0.1:8787/webhook/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "platform":"xiaohongshu",
    "title":"Test",
    "body":"Hello",
    "hashtags":["#demo"],
    "token":"optional",
    "dryRun":false
  }'
```

The server responds with a JSON receipt and also appends a line to a local `.jsonl` log.

### View jobs

```bash
curl "http://127.0.0.1:8787/jobs?limit=20"
```

## Where logs go

- `./.webhook-connector/jobs.jsonl` (repo-local)

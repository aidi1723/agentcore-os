# Connectors (Bring Your Own)

This project intentionally treats "auto publish" as a **connector problem**:

- The UI prepares platform variants and a publish payload
- The server can optionally dispatch to your connector webhook
- Your connector handles real posting via **official APIs** or approved services

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

It only logs receipts — it does not publish anywhere.

## Recommended real-world options

- Official platform APIs (preferred)
- Approved third-party schedulers (Buffer/Metricool/Make/Zapier)
- Internal tooling with explicit user consent and ToS compliance

## Mobile IM Bridge

AgentCore OS desktop builds now include a local `IM Bridge` in the Python sidecar so mobile users can trigger the desktop agent from DingTalk, Feishu, or any webhook-capable IM automation.

Recommended path:

- keep AgentCore OS running on the desktop
- expose the sidecar through `Cloudflare Tunnel`, `ngrok`, or `FRP`
- configure an `Access Token` in Settings -> `Mobile Access`
- forward IM messages to:
  - `POST /api/im-bridge/inbound/generic`
  - `POST /api/im-bridge/inbound/feishu`
  - `POST /api/im-bridge/inbound/dingtalk`

Supported auth modes:

- `Authorization: Bearer <Access Token>`
- `X-AgentCore-IM-Token: <Access Token>`
- query string: `?token=<Access Token>`

Native-style provider checks now supported:

- Feishu: optional request-body `token` verification
- DingTalk: optional `timestamp + sign` verification with signing secret

Minimal generic payload:

```json
{
  "text": "Please analyze this data and generate a reporting outline",
  "sessionId": "mobile-demo-user"
}
```

Minimal DingTalk-style payload:

```json
{
  "conversationId": "cid_mobile_demo",
  "senderStaffId": "staff_mobile_demo",
  "text": {
    "content": "Help me create this week's work report PPT"
  }
}
```

Minimal Feishu-style payload:

```json
{
  "event": {
    "sender": {
      "sender_id": {
        "open_id": "ou_mobile_demo"
      }
    },
    "message": {
      "chat_id": "oc_mobile_demo",
      "content": "{\"text\":\"Help me analyze this weekly sales report\"}"
    }
  }
}
```

When `Reply Webhook URL` is configured for the provider, AgentCore OS pushes the execution result back to the IM channel after the desktop agent completes the task.

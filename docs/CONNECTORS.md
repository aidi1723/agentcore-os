# Connectors (Bring Your Own)

This project intentionally treats "auto publish" as a **connector problem**:

- The UI prepares platform variants and a publish payload
- The server can optionally dispatch to your connector webhook
- Your connector handles real posting via **official APIs** or approved services

This also means the connector is an external execution boundary:

- AgentCore OS owns publish jobs, retries, queue state, and operator UI
- The connector owns downstream platform integration and connector-internal scheduling
- Connector health only proves the connector is reachable and self-reports basic readiness
- Connector receipts prove that the connector accepted or rejected the request, not that the final post is already fully live

Related decisions:

- `docs/adr/ADR-004-PUBLISH_JOB_LIFECYCLE_AND_RETRY_POLICY.zh-CN.md`
- `docs/adr/ADR-005-CONNECTOR_BOUNDARY_AND_TRUST_MODEL.zh-CN.md`

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

Required request semantics:

- `platform`: target platform id
- `title`: platform-ready title
- `body`: platform-ready body
- `hashtags`: optional tag suggestions
- `token`: platform-facing token or credential for the connector to consume
- `dryRun`: when `true`, the connector should avoid real posting and return a rehearsal-style receipt

Minimum success response:

```json
{ "ok": true, "id": "…" }
```

Recommended success response:

```json
{
  "ok": true,
  "id": "receipt-id",
  "platform": "xiaohongshu",
  "queued": true,
  "message": "Accepted by connector",
  "receivedAt": "2026-03-27T00:00:00.000Z"
}
```

Minimum error response:

```json
{ "ok": false, "error": "message" }
```

Recommended error response:

```json
{
  "ok": false,
  "error": "Invalid payload",
  "errorType": "validation",
  "retryable": false
}
```

Recommended `errorType` values:

- `validation`
- `auth`
- `rate_limit`
- `temporary`
- `provider`
- `unknown`

## Health contract

Minimum health response:

```json
{
  "ok": true,
  "name": "your-connector-name",
  "time": "2026-03-27T00:00:00.000Z"
}
```

Recommended extensions:

```json
{
  "ok": true,
  "name": "your-connector-name",
  "version": "1.0.0",
  "time": "2026-03-27T00:00:00.000Z",
  "capabilities": {
    "publishWebhook": true,
    "receiptListing": true,
    "dryRun": true
  }
}
```

The health endpoint should answer:

- Is the connector online?
- Can it accept requests?
- What basic capabilities does it expose?

It should not pretend to be a final publish-result endpoint.

## Receipt listing

If your connector supports receipt browsing, a practical shape is:

```json
{
  "ok": true,
  "jobs": [{ "id": "receipt-id", "platform": "xiaohongshu", "receivedAt": "..." }]
}
```

This is useful for:

- local demos
- operator troubleshooting
- verifying that AgentCore OS really delivered the request to the connector

## Local example connector

This repo includes a small local server:

- `scripts/webhook-connector/server.mjs`
- Run with `npm run webhook:dev`
- UI at `http://127.0.0.1:8787/`

It only logs receipts — it does not publish anywhere.
The example server demonstrates:

- `GET /health`
- `GET /jobs`
- `GET /jobs/:id`
- `POST /webhook/publish`
- machine-readable receipt fields like `queued`, `receivedAt`, and `retryable`

## Recommended real-world options

- Official platform APIs (preferred)
- Approved third-party schedulers (Buffer/Metricool/Make/Zapier)
- Internal tooling with explicit user consent and ToS compliance

## Operational guidance

- Keep connector endpoints private, authenticated, and rate-limited
- Prefer fast acknowledgment + internal async processing over long synchronous requests
- Let AgentCore OS retry delivery to the connector
- Let the connector handle provider-specific retries internally
- If you need stronger external exactly-once guarantees, add a connector-side idempotency key

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

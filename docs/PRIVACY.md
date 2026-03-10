# Privacy

## What is stored locally

This demo UI stores data in the browser (localStorage), including:

- LLM settings (API keys, base URLs, model names)
- Engine settings (base URL, token)
- Publishing connector tokens and webhook URLs
- Draft content and publish job history

## Important

LocalStorage is **not a secure secret store**.

For any real deployment:
- Move secrets to server-side storage
- Add authentication and per-user isolation
- Consider encrypting secrets at rest

## Redaction

When opening issues or sharing screenshots/logs:
- Remove tokens, API keys, and any personal identifiers


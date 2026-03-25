# openclaw-os Changelog

## v1.0.0 - Stable Baseline

First stable baseline for the local-first `openclaw-os` desktop shell.

### Product boundary

- Local-first dashboard for an existing OpenClaw workspace
- Conservative by default:
  - Social Ops is mock-only
  - Automation execution returns explicit `501 not implemented`
  - No silent publish or background mutation behavior
- Primary data sources remain:
  - local workspace files
  - local CLI status output

### Stable modules

- Taskboard summary
- Gateway status
- Nodes status
- Skills browser
- Logs browser
- Social Ops mock runner
- Automation catalog / stub contract

### Stability hardening in this line

- Taskboard summary moved to async file access
- Taskboard log reads no longer load `time_log.jsonl` in full by default
- Tail-based reads now scan backward in bounded chunks until they cover today's boundary
- Truncated first-line JSONL damage is tolerated without dropping later valid rows
- Native Node test execution and Next build now share a consistent TypeScript import setup

### Verification

- `npm run test`
- `npm run lint`
- `npm run build`

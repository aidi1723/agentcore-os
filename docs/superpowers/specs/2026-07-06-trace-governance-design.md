# Trace Governance Design

## Context

The controlled runtime now has durable playbooks, approval records, resume/retry paths, real writeback receipts, and Runtime Console asset landings for sales, knowledge, workflow, draft, and support records. Trace is no longer only a debug log. It is becoming the operator's audit trail and the raw material for regression fixtures.

The current controlled run API returns full `ControlledExecutionRunRecord` objects. That is acceptable for the local Runtime Console because it needs operational state for resume, retry, approval, and landing links. It is not yet a safe export or fixture boundary because step `input`, step `output`, approval feedback, tool outputs, and errors may contain customer messages, draft content, API tokens, authorization headers, contact details, or other sensitive business context.

## Goals

- Define a governed trace artifact shape for export and fixture generation.
- Redact sensitive trace fields without changing the existing durable controlled run storage model.
- Preserve operational metadata required for audit and replay diagnosis:
  - run ids, playbook ids, scenario ids, workflow ids,
  - step ids, states, attempts, timings,
  - schema validation status,
  - approval state and timing,
  - writeback target, success state, asset ids, source keys, workflow ids,
  - audit event type, actor, step id, and time.
- Redact or summarize fields that may contain free-form sensitive content:
  - run errors,
  - step input,
  - step output,
  - step errors,
  - approval feedback,
  - tool call output / error,
  - audit event message.
- Add tests that prove secrets and customer content do not cross the governed export boundary.

## Non-Goals

- No change to the internal controlled run store format in this slice.
- No deletion / retention job in the first slice.
- No Runtime Console visual redesign.
- No full replay engine in this slice.
- No attempt to classify every business field semantically. The first implementation uses conservative field-level policy plus existing text redaction.

## Proposed Design

### Governed Artifact

Add a new runtime module:

`src/lib/executor/runtime/trace-governance.ts`

It exports:

- `ControlledTraceGovernancePolicy`
- `ControlledTraceArtifact`
- `buildControlledTraceArtifact(run, options?)`
- `redactTraceValue(value, policy?)`

The artifact is a sanitized copy, not a mutation of the source run.

Default policy:

- `mode: "fixture"`
- `includePlan: true`
- `includeStepInput: false`
- `includeStepOutput: false`
- `includeToolOutputs: false`
- `maxStringLength: 240`

The artifact keeps structure and safe metadata, but replaces redacted free-form payloads with a stable object:

```ts
{
  redacted: true,
  reason: "trace_governance",
  summary: "object(keys=customer,message)"
}
```

Short scalar values used as ids remain visible when they are already in typed safe fields such as `assetId`, `sourceKey`, `workflowRunId`, `stepId`, and `playbookId`.

### Field Policy

Always keep:

- run: `id`, `requestId`, `sessionId`, `workflowRunId`, `scenarioId`, `playbookId`, `playbookVersion`, `planId`, `state`, `currentStepId`, `createdAt`, `updatedAt`, `finishedAt`.
- plan: `id`, `totalSteps`, `requiresApproval`, step `id`, `title`, `dependsOn`, `mode`, `writesTo`, `onFailure`; `goal` and step `description` are redacted because they are free-form text and may contain customer context.
- step: `stepId`, `state`, `startedAt`, `finishedAt`, `attempts`.
- approval: `executionId`, `stepId`, `state`, `requestedAt`, `resolvedAt`, `approver`.
- schema validation: `valid`, `errors`, `checkedAt`, with error text passed through text redaction and clipping.
- writeback receipts: `target`, `ok`, `writtenAt`, `assetId`, `sourceKey`, `workflowRunId`, and redacted / clipped `summary`.
- audit events: `id`, `type`, `stepId`, `createdAt`, `actor`, and redacted / clipped `message`.

Always redact by default:

- run `error`
- step `input`
- step `output`
- step `error`
- approval `feedback`
- `toolCallResults`

Tool call results are summarized as:

```ts
{
  toolName: "llm_generate",
  success: true,
  durationMs: 1200,
  output: { redacted: true, reason: "trace_governance", summary: "string(length=840)" },
  error: { redacted: true, reason: "trace_governance", summary: "string(length=40)" }
}
```

### API Boundary

Add a route in a later task after the artifact helper is tested:

`GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`

The route returns:

```ts
{
  ok: true,
  data: {
    artifact
  }
}
```

It must use the same local API security guard as existing runtime routes.

This keeps the existing controlled-runs list route untouched for Runtime Console operation while introducing a safe route for export / fixture flows.

### Runtime Console

For the first slice, Runtime Console only needs a minimal "governed trace artifact" open/download-ready action if the helper and route are in place. The action can be plain JSON preview or copy/download in a later slice.

No visual redesign is required. The console should eventually show whether a selected run has a governed artifact available.

## Testing

Add:

- `src/__tests__/lib/executor/runtime/trace-governance.test.ts`
- `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts` if the route is implemented in this phase.

Coverage:

- Redacts step input/output containing customer text and named secrets.
- Keeps safe run/playbook/step/writeback metadata.
- Redacts approval feedback and audit event message while keeping approval state / actor / timestamps.
- Summarizes tool call output without leaking raw output.
- Does not mutate the original `ControlledExecutionRunRecord`.
- Route returns a governed artifact and rejects unauthorized requests according to existing local API rules.

## Acceptance Criteria

- A controlled run can be converted into a governed trace artifact without leaking raw step input/output/tool output.
- Artifact metadata remains useful for audit, debugging, and future fixture generation.
- Existing Runtime Console controlled run operations remain unchanged.
- Tests prove the redaction boundary and non-mutating behavior.
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, `npm run build`, and `git diff --check` pass with only the known existing `<img>` warning if it remains.

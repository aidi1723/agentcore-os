# Trace Governance Console Export And Retention Design

## Context

Phase 10 added a governed controlled-run trace artifact builder and a local-only artifact route:

`GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`

That route is the safe boundary for fixture/export use. Runtime Console still shows operational run state from the raw controlled run list, and the store still only applies a coarse `MAX_RUNS` cap. The next slice should let operators obtain the governed artifact from the console and define a prune path that does not delete active work.

## Goals

- Add a Runtime Console action that fetches the governed artifact for the selected run and copies export-safe JSON.
- Keep Runtime Console resume, retry, approval, and asset landing behavior on the existing raw local run route.
- Add export metadata that makes copied artifacts self-describing:
  - run id,
  - playbook id / version,
  - scenario id,
  - workflow run id,
  - generated timestamp,
  - fixture-oriented filename.
- Add a server-side retention policy type and prune helper for raw controlled execution runs.
- Make pruning conservative:
  - never delete `running` runs,
  - never delete `awaiting_approval` runs,
  - never delete terminal runs newer than the retention threshold,
  - keep the most recent terminal runs above a minimum count.
- Add tests for console export, artifact route metadata, and prune safety.

## Non-Goals

- No automatic scheduled retention job in this slice.
- No visual redesign of Runtime Console.
- No browser file download requirement; clipboard JSON is enough for the first console export path.
- No replay engine.
- No change to the raw controlled run record shape.
- No deletion of non-terminal runs even when they are old.

## Proposed Design

### Artifact Route Response

Keep the existing artifact route and extend the response metadata:

```ts
{
  ok: true,
  data: {
    artifact,
    export: {
      filename: "controlled-trace-<runId>-<timestamp>.json",
      generatedAt: 1760000000000,
      contentType: "application/json",
      governanceMode: "fixture"
    }
  }
}
```

The route still returns only the governed artifact. It must not return the raw controlled run.

### Runtime Console Export Action

In the selected run detail area, add a compact trace governance control next to the existing run action controls:

- label: `Governed trace`
- helper text: `Copies redacted trace JSON for audit or fixture use.`
- action button: `复制脱敏 Trace`

On click:

1. Fetch `/api/runtime/executor/controlled-runs/{runId}/trace-artifact`.
2. Validate `ok` and `data.artifact`.
3. Serialize:

```ts
JSON.stringify(
  {
    export: data.data.export,
    artifact: data.data.artifact,
  },
  null,
  2,
)
```

4. Copy to clipboard through the existing clipboard pattern.
5. Show success or failure toast.

The console must not serialize `selectedControlledRunSummary` or the raw run record for export.

### Retention Policy And Prune Helper

Add a store-level policy:

```ts
export type ControlledRunRetentionPolicy = {
  now?: number;
  maxAgeMs: number;
  minTerminalRunsToKeep: number;
};
```

Add:

```ts
export async function pruneControlledExecutionRuns(
  policy: ControlledRunRetentionPolicy,
): Promise<{
  prunedRunIds: string[];
  keptRunIds: string[];
}>;
```

Rules:

- Active states are always kept: `running`, `awaiting_approval`.
- Terminal states are candidates only when `updatedAt < now - maxAgeMs`.
- Sort terminal runs by `updatedAt` descending.
- Keep at least `minTerminalRunsToKeep` terminal runs, even if old.
- Return ids of pruned and kept runs for audit/test visibility.

No API route is required for prune in this slice. A manual route can be added later after the policy is proven.

## UI Design Constraints

Use the existing AgentCore OS `DESIGN.md` operational cockpit language:

- restrained neutral surface,
- compact button,
- clear helper copy,
- no new card-inside-card pattern,
- no decorative visual treatment.

The export action should look like an operational tool, not a marketing feature.

## Testing

Add or extend:

- `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`
  - proves response includes export metadata and no raw payload leakage.
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
  - proves the console fetches the governed artifact route,
  - proves copied text includes `artifact`,
  - proves copied text does not include raw customer/secret payloads.
- `src/__tests__/lib/server/controlled-execution-store.test.ts`
  - proves prune keeps `running` and `awaiting_approval` runs,
  - proves prune removes old terminal runs,
  - proves prune keeps the newest terminal runs according to `minTerminalRunsToKeep`.

## Acceptance Criteria

- Runtime Console has a visible governed trace export action for the selected controlled run.
- The console export uses the governed route, not the raw controlled run object.
- Copied JSON includes export metadata and governed artifact.
- Raw step input/output/tool output remains redacted in copied JSON.
- Store pruning is explicit, tested, and cannot remove active or approval-blocked runs.
- Existing controlled runtime operations continue to pass.

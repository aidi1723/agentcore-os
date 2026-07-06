# Release Handoff Retry Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the timing margin that made the `server backed retry` core workflow regression intermittently fail inside the release handoff gate.

**Architecture:** Add a focused fake-timer test for `createServerBackedListState()` proving explicit retry timings below `100ms` are honored. Then update retry timing normalization so omitted config keeps the existing production defaults while explicit test/local harness values are not clamped to `100ms`.

**Tech Stack:** TypeScript, Vitest fake timers, Node/JS DOM test environment, existing server-backed list state helper.

---

## File Structure

- Create `src/__tests__/lib/server-backed-list-state.test.ts`
  - Owns focused retry timing coverage for server-backed list state.
- Modify `src/lib/server-backed-list-state.ts`
  - Changes only retry timing normalization.
- Modify `package.json`
  - Adds the new test file to `test:controlled-runtime`.
- Modify docs/logs:
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `memory/2026-07-07.md`

## Task 1: Add Failing Retry Timing Test

**Files:**
- Create: `src/__tests__/lib/server-backed-list-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/server-backed-list-state.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServerBackedListState,
  getServerBackedSyncStatus,
} from "@/lib/server-backed-list-state";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function installBrowserStub() {
  const localStorage = new MemoryStorage();
  const eventTarget = new EventTarget();
  vi.stubGlobal("window", {
    localStorage,
    dispatchEvent: (event: Event) => eventTarget.dispatchEvent(event),
    addEventListener: (...args: Parameters<EventTarget["addEventListener"]>) =>
      eventTarget.addEventListener(...args),
    removeEventListener: (...args: Parameters<EventTarget["removeEventListener"]>) =>
      eventTarget.removeEventListener(...args),
  });
  vi.stubGlobal("localStorage", localStorage);
  return localStorage;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("server-backed list state", () => {
  it("honors explicit retry timing below the production default floor", async () => {
    vi.useFakeTimers();
    installBrowserStub();

    let attempts = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.endsWith("/api/runtime/test-sync") && init?.method === "POST") {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary network failure");
        }
        const payload = init.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            ok: true,
            data: { item: payload.item, tombstone: null },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true, data: { items: [], tombstones: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const state = createServerBackedListState({
      statusId: "agentcore.retry.unit",
      statusLabel: "Retry Unit",
      storageKey: "agentcore.retry.unit",
      eventName: "agentcore:retry-unit",
      maxItems: 10,
      listPath: "/api/runtime/test-sync",
      itemBodyKey: "item",
      retryBaseMs: 10,
      retryMaxMs: 20,
      sortItems: (items) => items.slice().sort((a, b) => b.updatedAt - a.updatedAt),
      parseHydrateData: (data) => ({
        items: Array.isArray((data as { data?: { items?: unknown[] } })?.data?.items)
          ? ((data as { data: { items: Array<{ id: string; updatedAt: number }> } }).data.items)
          : null,
        tombstones: [],
      }),
      parseUpsertData: (data) => ({
        item:
          (data as { data?: { item?: { id: string; updatedAt: number; value: string } } })?.data
            ?.item ?? null,
        tombstone: null,
      }),
    });

    const firstSync = await state.syncItemToServer({
      id: "retry-item-1",
      updatedAt: 100,
      value: "local",
    });

    expect(firstSync).toBe(false);
    expect(attempts).toBe(1);

    await vi.advanceTimersByTimeAsync(50);

    expect(attempts).toBe(2);
    expect(state.getPendingSyncCount()).toBe(0);
    expect(getServerBackedSyncStatus("agentcore.retry.unit")?.pendingCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npm test -- src/__tests__/lib/server-backed-list-state.test.ts
```

Expected: fail because the retry is still clamped to `100ms`, so advancing fake
timers by `50ms` does not trigger the second attempt.

## Task 2: Honor Explicit Retry Timing

**Files:**
- Modify: `src/lib/server-backed-list-state.ts`

- [ ] **Step 1: Change retry timing normalization**

Replace:

```ts
const retryBaseMs = Math.max(100, config.retryBaseMs ?? 750);
const retryMaxMs = Math.max(retryBaseMs, config.retryMaxMs ?? 30_000);
```

with:

```ts
const retryBaseMs =
  config.retryBaseMs === undefined ? 750 : Math.max(0, config.retryBaseMs);
const retryMaxMs =
  config.retryMaxMs === undefined ? 30_000 : Math.max(retryBaseMs, config.retryMaxMs);
```

- [ ] **Step 2: Run the target test and confirm GREEN**

Run:

```bash
npm test -- src/__tests__/lib/server-backed-list-state.test.ts
```

Expected: 1 test passes.

## Task 3: Wire Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the new test file to `test:controlled-runtime`**

Add:

```text
src/__tests__/lib/server-backed-list-state.test.ts
```

near `src/__tests__/lib/server/controlled-execution-store.test.ts`.

- [ ] **Step 2: Run the controlled runtime suite**

Run:

```bash
npm run test:controlled-runtime
```

Expected: suite passes and reports one additional file/test compared with the
previous `44 files / 227 tests` baseline.

## Task 4: Update Docs and Memory

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Add release gate stability notes**

Document:

- the observed transient `server backed retry` failure;
- explicit retry timing is now honored for local/test harnesses;
- default production retry values remain `750ms` and `30_000ms`;
- no publishing or UI behavior changed.

- [ ] **Step 2: Update test baseline counts**

Update the controlled runtime baseline after the fresh suite run.

## Task 5: Final Verification, Commit, and Push

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run focused test**

```bash
npm test -- src/__tests__/lib/server-backed-list-state.test.ts
```

- [ ] **Step 2: Run core workflow regression**

```bash
npm run test:core-workflows
```

- [ ] **Step 3: Run controlled runtime suite**

```bash
npm run test:controlled-runtime
```

- [ ] **Step 4: Run handoff commands**

```bash
npm run release:handoff:check
npm run release:handoff:snapshot
```

Expected:

- handoff gate passes;
- snapshot writes local evidence under `output/release-handoff/`;
- generated evidence remains unstaged.

- [ ] **Step 5: Run quality checks**

```bash
npm run lint
npm run build
git diff --check
```

Known acceptable warning:

- existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [ ] **Step 6: Commit and push**

Stage only this phase's source, tests, docs, and plan:

```bash
git add src/lib/server-backed-list-state.ts \
  src/__tests__/lib/server-backed-list-state.test.ts \
  package.json \
  CHANGELOG.md \
  docs/NEXT_STEPS.md \
  docs/superpowers/plans/2026-07-07-release-handoff-retry-stability.md
git commit -m "fix: stabilize server backed retry timing"
git push
```

Do not stage `output/release-handoff/` or other local context files.

## Self-Review

- Spec coverage: this plan covers root cause, failing test, minimal fix,
  controlled-runtime inclusion, docs, verification, and local evidence boundary.
- Placeholder scan: no placeholders remain.
- Type consistency: test imports and function names match
  `server-backed-list-state.ts`.
- Scope check: no UI, publishing, dependency, release artifact, route, or retry
  policy redesign is included.

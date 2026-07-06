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

type RetryItem = {
  id: string;
  updatedAt: number;
  value: string;
};

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
      return new Response(
        JSON.stringify({ ok: true, data: { items: [], tombstones: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const state = createServerBackedListState<RetryItem>({
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
          ? ((data as { data: { items: RetryItem[] } }).data.items)
          : null,
        tombstones: [],
      }),
      parseUpsertData: (data) => ({
        item: (data as { data?: { item?: RetryItem } })?.data?.item ?? null,
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

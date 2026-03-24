import { buildAgentCoreApiUrl } from "@/lib/app-api";

type Listener = () => void;

export type SyncTombstoneRecord = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type HydrateContext<TItem, TTombstone extends SyncTombstoneRecord> = {
  localItems: TItem[];
  serverItems: TItem[];
  tombstones: TTombstone[];
  serverById: Map<string, TItem>;
  tombstoneById: Map<string, TTombstone>;
};

type ServerBackedListConfig<
  TItem extends { id: string; updatedAt: number },
  TTombstone extends SyncTombstoneRecord = SyncTombstoneRecord,
> = {
  statusId: string;
  statusLabel: string;
  storageKey: string;
  eventName: string;
  maxItems: number;
  listPath: string;
  itemBodyKey: string;
  upsertPath?: string;
  deletePath?: (itemId: string) => string;
  sortItems: (items: TItem[]) => TItem[];
  parseHydrateData: (data: unknown) => {
    items: TItem[] | null;
    tombstones?: TTombstone[] | null;
  };
  parseUpsertData: (data: unknown) => {
    item?: TItem | null;
    tombstone?: TTombstone | null;
  };
  parseDeleteData?: (data: unknown) => {
    item?: TItem | null;
    tombstone?: TTombstone | null;
  };
  mergeItems?: (localItems: TItem[], serverItems: TItem[]) => TItem[];
  applyTombstones?: (items: TItem[], tombstones: TTombstone[]) => TItem[];
  shouldResyncLocalItem?: (
    item: TItem,
    context: HydrateContext<TItem, TTombstone>,
  ) => boolean;
  retryBaseMs?: number;
  retryMaxMs?: number;
};

export type ServerBackedSyncStatus = {
  id: string;
  label: string;
  pendingCount: number;
  nextRetryAt: number | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  phase: "idle" | "syncing" | "retrying";
};

const syncStatusRegistry = new Map<string, ServerBackedSyncStatus>();
const SYNC_STATUS_EVENT = "agentcore:server-backed-sync-status";

function emitGlobalSyncStatusUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
  }
}

export function listServerBackedSyncStatuses() {
  return Array.from(syncStatusRegistry.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "zh-CN"),
  );
}

export function getServerBackedSyncStatus(statusId: string) {
  return syncStatusRegistry.get(statusId) ?? null;
}

export function getServerBackedSyncStatusEventName() {
  return SYNC_STATUS_EVENT;
}

type PendingSyncOperation<TItem extends { id: string; updatedAt: number }> =
  | {
      kind: "upsert";
      itemId: string;
      item: TItem;
      attempts: number;
      nextRetryAt: number;
    }
  | {
      kind: "delete";
      itemId: string;
      updatedAt: number;
      attempts: number;
      nextRetryAt: number;
    };

function defaultMergeItems<TItem extends { id: string; updatedAt: number }>(
  localItems: TItem[],
  serverItems: TItem[],
  sortItems: (items: TItem[]) => TItem[],
) {
  const merged = new Map<string, TItem>();
  for (const item of [...serverItems, ...localItems]) {
    const existing = merged.get(item.id);
    if (!existing || existing.updatedAt <= item.updatedAt) {
      merged.set(item.id, item);
    }
  }
  return sortItems(Array.from(merged.values()));
}

function defaultApplyTombstones<
  TItem extends { id: string; updatedAt: number },
  TTombstone extends SyncTombstoneRecord,
>(items: TItem[], tombstones: TTombstone[]) {
  if (tombstones.length === 0) return items;
  const latestTombstones = new Map<string, TTombstone>();
  for (const tombstone of tombstones) {
    const existing = latestTombstones.get(tombstone.id);
    if (!existing || existing.deletedAt <= tombstone.deletedAt) {
      latestTombstones.set(tombstone.id, tombstone);
    }
  }
  return items.filter((item) => {
    const tombstone = latestTombstones.get(item.id);
    return !tombstone || item.updatedAt > tombstone.deletedAt;
  });
}

function defaultShouldResyncLocalItem<
  TItem extends { id: string; updatedAt: number },
  TTombstone extends SyncTombstoneRecord,
>(item: TItem, context: HydrateContext<TItem, TTombstone>) {
  const serverItem = context.serverById.get(item.id);
  const tombstone = context.tombstoneById.get(item.id);
  if (tombstone && tombstone.deletedAt >= item.updatedAt) {
    return false;
  }
  return !serverItem || item.updatedAt > serverItem.updatedAt;
}

export function createServerBackedListState<
  TItem extends { id: string; updatedAt: number },
  TTombstone extends SyncTombstoneRecord = SyncTombstoneRecord,
>(config: ServerBackedListConfig<TItem, TTombstone>) {
  const listeners = new Set<Listener>();
  let hydratePromise: Promise<TItem[] | null> | null = null;
  let autoHydrationBound = false;
  const pendingOps = new Map<string, PendingSyncOperation<TItem>>();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let flushPromise: Promise<void> | null = null;
  const retryBaseMs = Math.max(100, config.retryBaseMs ?? 750);
  const retryMaxMs = Math.max(retryBaseMs, config.retryMaxMs ?? 30_000);
  let isFlushing = false;

  function writeSyncStatus(patch: Partial<Omit<ServerBackedSyncStatus, "id" | "label">>) {
    const existing = syncStatusRegistry.get(config.statusId);
    const pendingCount = patch.pendingCount ?? existing?.pendingCount ?? 0;
    const nextRetryAt =
      patch.nextRetryAt === undefined ? existing?.nextRetryAt ?? null : patch.nextRetryAt;
    const phase =
      patch.phase ??
      (pendingCount > 0
        ? nextRetryAt && nextRetryAt > Date.now()
          ? "retrying"
          : isFlushing
            ? "syncing"
            : "retrying"
        : isFlushing
          ? "syncing"
          : "idle");
    syncStatusRegistry.set(config.statusId, {
      id: config.statusId,
      label: config.statusLabel,
      pendingCount,
      nextRetryAt,
      lastAttemptAt:
        patch.lastAttemptAt === undefined ? existing?.lastAttemptAt ?? null : patch.lastAttemptAt,
      lastSuccessAt:
        patch.lastSuccessAt === undefined ? existing?.lastSuccessAt ?? null : patch.lastSuccessAt,
      lastError: patch.lastError === undefined ? existing?.lastError ?? null : patch.lastError,
      phase,
    });
    emitGlobalSyncStatusUpdate();
  }

  writeSyncStatus({
    pendingCount: 0,
    nextRetryAt: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    phase: "idle",
  });

  function emit() {
    for (const listener of listeners) listener();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(config.eventName));
    }
  }

  function isRetriableStatus(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function nextRetryDelay(attempts: number) {
    return Math.min(retryMaxMs, retryBaseMs * 2 ** Math.max(0, attempts - 1));
  }

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function getPendingSyncCount() {
    return pendingOps.size;
  }

  function scheduleFlushPendingOps(delayMs = 0) {
    if (typeof window === "undefined") return;
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flushPendingOps();
    }, Math.max(0, delayMs));
  }

  function enqueuePendingOperation(operation: PendingSyncOperation<TItem>) {
    const existing = pendingOps.get(operation.itemId);
    if (existing) {
      if (existing.kind === "delete" && operation.kind === "upsert") {
        if (existing.updatedAt >= operation.item.updatedAt) {
          return;
        }
      }
      if (existing.kind === "upsert" && operation.kind === "delete") {
        if (existing.item.updatedAt > operation.updatedAt) {
          return;
        }
      }
      if (
        existing.kind === operation.kind &&
        existing.attempts > operation.attempts &&
        existing.nextRetryAt >= operation.nextRetryAt
      ) {
        return;
      }
    }

    pendingOps.set(operation.itemId, operation);
    const nextAt = Math.min(...Array.from(pendingOps.values()).map((item) => item.nextRetryAt));
    writeSyncStatus({
      pendingCount: pendingOps.size,
      nextRetryAt: Number.isFinite(nextAt) ? nextAt : null,
      phase: "retrying",
    });
    scheduleFlushPendingOps(Math.max(0, nextAt - Date.now()));
  }

  function load() {
    if (typeof window === "undefined") return [] as TItem[];
    try {
      const raw = window.localStorage.getItem(config.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as TItem[]) : [];
    } catch {
      return [];
    }
  }

  function saveLocal(items: TItem[]) {
    if (typeof window === "undefined") return;
    try {
      const normalized = config.sortItems(items).slice(0, config.maxItems);
      window.localStorage.setItem(config.storageKey, JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }

  function getItems() {
    return config.sortItems(load());
  }

  function upsertLocalItem(item: TItem) {
    saveLocal([item, ...load().filter((existing) => existing.id !== item.id)]);
  }

  function applyTombstone(tombstone: TTombstone) {
    const next = (config.applyTombstones ?? defaultApplyTombstones)(load(), [tombstone]);
    saveLocal(next);
    pendingOps.delete(tombstone.id);
    const nextRetryAt = Math.min(...Array.from(pendingOps.values()).map((item) => item.nextRetryAt));
    writeSyncStatus({
      pendingCount: pendingOps.size,
      nextRetryAt: Number.isFinite(nextRetryAt) ? nextRetryAt : null,
      lastSuccessAt: Date.now(),
      lastError: null,
    });
  }

  async function syncItemToServer(item: TItem, attempt = 0): Promise<boolean> {
    writeSyncStatus({
      lastAttemptAt: Date.now(),
      phase: pendingOps.size > 0 ? "retrying" : "syncing",
    });
    try {
      const res = await fetch(buildAgentCoreApiUrl(config.upsertPath ?? config.listPath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [config.itemBodyKey]: item }),
      });
      const data = config.parseUpsertData(await res.json().catch(() => null));
      if (data.tombstone) {
        applyTombstone(data.tombstone);
        pendingOps.delete(item.id);
        emit();
        return true;
      }
      if (data.item) {
        upsertLocalItem(data.item);
        pendingOps.delete(item.id);
        const nextRetryAt = Math.min(
          ...Array.from(pendingOps.values()).map((operation) => operation.nextRetryAt),
        );
        writeSyncStatus({
          pendingCount: pendingOps.size,
          nextRetryAt: Number.isFinite(nextRetryAt) ? nextRetryAt : null,
          lastSuccessAt: Date.now(),
          lastError: null,
        });
        emit();
        return true;
      }
      if (isRetriableStatus(res.status) || res.ok) {
        writeSyncStatus({ lastError: `upsert failed: ${res.status}` });
        enqueuePendingOperation({
          kind: "upsert",
          itemId: item.id,
          item,
          attempts: attempt + 1,
          nextRetryAt: Date.now() + nextRetryDelay(attempt + 1),
        });
      } else {
        writeSyncStatus({
          lastError: `upsert failed: ${res.status}`,
          phase: pendingOps.size > 0 ? "retrying" : "idle",
        });
      }
      return false;
    } catch {
      writeSyncStatus({ lastError: "upsert network failure" });
      enqueuePendingOperation({
        kind: "upsert",
        itemId: item.id,
        item,
        attempts: attempt + 1,
        nextRetryAt: Date.now() + nextRetryDelay(attempt + 1),
      });
      return false;
    }
  }

  async function removeItemOnServer(
    itemId: string,
    updatedAt: number,
    attempt = 0,
  ): Promise<boolean> {
    if (!config.deletePath) return false;
    writeSyncStatus({
      lastAttemptAt: Date.now(),
      phase: pendingOps.size > 0 ? "retrying" : "syncing",
    });
    try {
      const res = await fetch(buildAgentCoreApiUrl(config.deletePath(itemId)), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt }),
      });
      const parser = config.parseDeleteData ?? config.parseUpsertData;
      const data = parser(await res.json().catch(() => null));

      if (data.tombstone) {
        applyTombstone(data.tombstone);
        pendingOps.delete(itemId);
        emit();
        return true;
      }
      if (data.item) {
        upsertLocalItem(data.item);
        pendingOps.delete(itemId);
        const nextRetryAt = Math.min(
          ...Array.from(pendingOps.values()).map((operation) => operation.nextRetryAt),
        );
        writeSyncStatus({
          pendingCount: pendingOps.size,
          nextRetryAt: Number.isFinite(nextRetryAt) ? nextRetryAt : null,
          lastSuccessAt: Date.now(),
          lastError: null,
        });
        emit();
        return true;
      }
      if (!res.ok && !isRetriableStatus(res.status)) {
        writeSyncStatus({
          lastError: `delete failed: ${res.status}`,
          phase: pendingOps.size > 0 ? "retrying" : "idle",
        });
        await hydrateFromServer(true);
        return false;
      }
      writeSyncStatus({ lastError: `delete failed: ${res.status}` });
      enqueuePendingOperation({
        kind: "delete",
        itemId,
        updatedAt,
        attempts: attempt + 1,
        nextRetryAt: Date.now() + nextRetryDelay(attempt + 1),
      });
      return false;
    } catch {
      writeSyncStatus({ lastError: "delete network failure" });
      enqueuePendingOperation({
        kind: "delete",
        itemId,
        updatedAt,
        attempts: attempt + 1,
        nextRetryAt: Date.now() + nextRetryDelay(attempt + 1),
      });
      return false;
    }
  }

  async function flushPendingOps() {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      isFlushing = true;
      writeSyncStatus({
        phase: pendingOps.size > 0 ? "retrying" : "syncing",
      });
      try {
        const now = Date.now();
        const dueOps = Array.from(pendingOps.values())
          .filter((operation) => operation.nextRetryAt <= now)
          .sort((left, right) => left.nextRetryAt - right.nextRetryAt);

        for (const operation of dueOps) {
          if (operation.kind === "upsert") {
            await syncItemToServer(operation.item, operation.attempts);
          } else {
            await removeItemOnServer(operation.itemId, operation.updatedAt, operation.attempts);
          }
        }

        const nextRetryAt = Math.min(
          ...Array.from(pendingOps.values()).map((operation) => operation.nextRetryAt),
        );
        if (Number.isFinite(nextRetryAt)) {
          scheduleFlushPendingOps(Math.max(0, nextRetryAt - Date.now()));
        }
      } finally {
        isFlushing = false;
        const nextRetryAt = Math.min(
          ...Array.from(pendingOps.values()).map((operation) => operation.nextRetryAt),
        );
        writeSyncStatus({
          pendingCount: pendingOps.size,
          nextRetryAt: Number.isFinite(nextRetryAt) ? nextRetryAt : null,
          phase:
            pendingOps.size > 0 && Number.isFinite(nextRetryAt) && nextRetryAt > Date.now()
              ? "retrying"
              : "idle",
        });
        flushPromise = null;
      }
    })();
    return flushPromise;
  }

  async function hydrateFromServer(force = false) {
    if (typeof window === "undefined") return null;
    if (!force && hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const res = await fetch(buildAgentCoreApiUrl(config.listPath), {
          method: "GET",
          cache: "no-store",
        });
        const parsed = config.parseHydrateData(await res.json().catch(() => null));
        const serverItems = parsed.items;
        const tombstones = Array.isArray(parsed.tombstones) ? parsed.tombstones : [];
        if (!res.ok || !serverItems) return null;

        const localItems = load();
        const mergedItems = (config.mergeItems ?? ((local, server) =>
          defaultMergeItems(local, server, config.sortItems)))(localItems, serverItems);
        const nextItems = (config.applyTombstones ?? defaultApplyTombstones)(
          mergedItems,
          tombstones,
        );

        saveLocal(nextItems);

        const context: HydrateContext<TItem, TTombstone> = {
          localItems,
          serverItems,
          tombstones,
          serverById: new Map(serverItems.map((item) => [item.id, item])),
          tombstoneById: new Map(tombstones.map((tombstone) => [tombstone.id, tombstone])),
        };
        const shouldResync =
          config.shouldResyncLocalItem ?? defaultShouldResyncLocalItem<TItem, TTombstone>;
        for (const item of localItems) {
          if (shouldResync(item, context)) {
            void syncItemToServer(item);
          }
        }
        void flushPendingOps();

        emit();
        return nextItems;
      } catch {
        return null;
      } finally {
        hydratePromise = null;
      }
    })();

    return hydratePromise;
  }

  function handleVisibilitySync() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void hydrateFromServer(true);
    void flushPendingOps();
  }

  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== config.storageKey) return;
    emit();
  }

  function bindAutoHydration() {
    if (autoHydrationBound || typeof window === "undefined") return;
    autoHydrationBound = true;
    window.addEventListener("focus", handleVisibilitySync);
    window.addEventListener("online", handleVisibilitySync);
    window.addEventListener("storage", handleStorage);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilitySync);
    }
  }

  function unbindAutoHydration() {
    if (!autoHydrationBound || typeof window === "undefined") return;
    autoHydrationBound = false;
    window.removeEventListener("focus", handleVisibilitySync);
    window.removeEventListener("online", handleVisibilitySync);
    window.removeEventListener("storage", handleStorage);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilitySync);
    }
  }

  function subscribe(listener: Listener) {
    bindAutoHydration();
    listeners.add(listener);
    void hydrateFromServer();
    void flushPendingOps();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        unbindAutoHydration();
        clearRetryTimer();
      }
    };
  }

  return {
    emit,
    getItems,
    load,
    saveLocal,
    upsertLocalItem,
    syncItemToServer,
    removeItemOnServer,
    hydrateFromServer,
    flushPendingOps,
    getPendingSyncCount,
    subscribe,
  };
}

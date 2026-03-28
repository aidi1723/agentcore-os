import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { SupportWorkflowMeta } from "@/lib/support-workflow";

export type InboxSource = "newsletter" | "client" | "internal";

export type InboxItem = {
  id: string;
  source: InboxSource;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
} & SupportWorkflowMeta;

export type InboxDigest = {
  id: string;
  focus: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type InboxItemTombstone = SyncTombstoneRecord;
type InboxDigestTombstone = SyncTombstoneRecord;

const ITEMS_KEY = "openclaw.inbox.items.v1";
const DIGESTS_KEY = "openclaw.inbox.digests.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:inbox"));
  }
}

function sortInboxItems(items: InboxItem[]) {
  return items
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 120);
}

function sortInboxDigests(items: InboxDigest[]) {
  return items
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 40);
}

const inboxItemState = createServerBackedListState<InboxItem, InboxItemTombstone>({
  statusId: "inbox-items",
  statusLabel: "收件箱条目",
  storageKey: ITEMS_KEY,
  eventName: "openclaw:inbox",
  maxItems: 120,
  listPath: "/api/runtime/state/inbox/items",
  deletePath: (itemId) => `/api/runtime/state/inbox/items/${encodeURIComponent(itemId)}`,
  itemBodyKey: "item",
  sortItems: sortInboxItems,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { items?: InboxItem[]; tombstones?: InboxItemTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.items) ? payload.data.items : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { item?: InboxItem | null; tombstone?: InboxItemTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.item ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

const inboxDigestState = createServerBackedListState<InboxDigest, InboxDigestTombstone>({
  statusId: "inbox-digests",
  statusLabel: "收件箱摘要",
  storageKey: DIGESTS_KEY,
  eventName: "openclaw:inbox",
  maxItems: 40,
  listPath: "/api/runtime/state/inbox/digests",
  itemBodyKey: "digest",
  sortItems: sortInboxDigests,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { digests?: InboxDigest[]; tombstones?: InboxDigestTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.digests) ? payload.data.digests : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            digest?: InboxDigest | null;
            tombstone?: InboxDigestTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.digest ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateInboxFromServer(force = false) {
  await Promise.all([
    inboxItemState.hydrateFromServer(force),
    inboxDigestState.hydrateFromServer(force),
  ]);
}

export function getInboxItems() {
  return inboxItemState.getItems();
}

export function createInboxItem(
  input: {
    source: InboxSource;
    title: string;
    body: string;
  } & SupportWorkflowMeta,
) {
  const now = Date.now();
  const item: InboxItem = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    source: input.source,
    title: input.title.trim() || "未命名邮件",
    body: input.body,
    workflowRunId: input.workflowRunId,
    workflowScenarioId: input.workflowScenarioId,
    workflowStageId: input.workflowStageId,
    workflowSource: input.workflowSource?.trim() || undefined,
    workflowNextStep: input.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  inboxItemState.saveLocal([item, ...inboxItemState.load()]);
  emit();
  void inboxItemState.syncItemToServer(item);
  return item.id;
}

export function updateInboxItem(
  itemId: string,
  patch: Partial<Omit<InboxItem, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  let nextItem: InboxItem | null = null;
  inboxItemState.saveLocal(
    inboxItemState.load().map((item) => {
      if (item.id !== itemId) return item;
      nextItem = {
        ...item,
        ...patch,
        updatedAt: now,
      };
      return nextItem;
    }),
  );
  emit();
  if (nextItem) {
    void inboxItemState.syncItemToServer(nextItem);
  }
}

export function removeInboxItem(itemId: string) {
  const current = inboxItemState.load().find((item) => item.id === itemId) ?? null;
  inboxItemState.saveLocal(inboxItemState.load().filter((item) => item.id !== itemId));
  emit();
  if (current) {
    void inboxItemState.removeItemOnServer(itemId, current.updatedAt);
  }
}

export function getInboxDigests() {
  return inboxDigestState.getItems();
}

export function createInboxDigest(input: { focus: string; content: string }) {
  const now = Date.now();
  const digest: InboxDigest = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    createdAt: now,
    updatedAt: now,
    focus: input.focus,
    content: input.content,
  };
  inboxDigestState.saveLocal([digest, ...inboxDigestState.load()]);
  emit();
  void inboxDigestState.syncItemToServer(digest);
  return digest.id;
}

export function subscribeInbox(listener: Listener) {
  listeners.add(listener);
  void hydrateInboxFromServer();
  return () => listeners.delete(listener);
}

import type { InboxDigest, InboxItem, InboxSource } from "@/lib/inbox";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const ITEM_FILE_NAME = "inbox-items.json";
const DIGEST_FILE_NAME = "inbox-digests.json";
const MAX_ITEMS = 240;
const MAX_DIGESTS = 80;
const SOURCES = new Set<InboxSource>(["newsletter", "client", "internal"]);

export type InboxItemTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

export type InboxDigestTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type InboxItemStoreEntry = InboxItem | InboxItemTombstone;
type InboxDigestStoreEntry = InboxDigest | InboxDigestTombstone;

function normalizeInboxItem(input: unknown): InboxItem | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;
  return {
    id,
    source:
      typeof item.source === "string" && SOURCES.has(item.source as InboxSource)
        ? (item.source as InboxSource)
        : "internal",
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名邮件",
    body: typeof item.body === "string" ? item.body : "",
    workflowRunId: typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    workflowScenarioId:
      typeof item.workflowScenarioId === "string" ? item.workflowScenarioId : undefined,
    workflowStageId: typeof item.workflowStageId === "string" ? item.workflowStageId : undefined,
    workflowSource: typeof item.workflowSource === "string" ? item.workflowSource : undefined,
    workflowNextStep:
      typeof item.workflowNextStep === "string" ? item.workflowNextStep : undefined,
    workflowTriggerType:
      item.workflowTriggerType === "manual" ||
      item.workflowTriggerType === "schedule" ||
      item.workflowTriggerType === "inbound_message" ||
      item.workflowTriggerType === "web_form"
        ? item.workflowTriggerType
        : undefined,
    createdAt,
    updatedAt,
  };
}

function normalizeInboxItemTombstone(input: unknown): InboxItemTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return { id, updatedAt, deletedAt };
}

function isInboxItemTombstone(entry: InboxItemStoreEntry): entry is InboxItemTombstone {
  return "deletedAt" in entry;
}

function normalizeInboxItemEntry(input: unknown): InboxItemStoreEntry | null {
  return normalizeInboxItemTombstone(input) ?? normalizeInboxItem(input);
}

function normalizeInboxItemEntries(raw: unknown): InboxItemStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, InboxItemStoreEntry>();
  for (const item of raw) {
    const entry = normalizeInboxItemEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isInboxItemTombstone(existing) &&
      isInboxItemTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveInboxItems(entries: InboxItemStoreEntry[]) {
  return entries.filter((entry): entry is InboxItem => !isInboxItemTombstone(entry));
}

function inboxItemTombstones(entries: InboxItemStoreEntry[]) {
  return entries.filter(isInboxItemTombstone);
}

function normalizeInboxDigest(input: unknown): InboxDigest | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;
  return {
    id,
    focus: typeof item.focus === "string" ? item.focus : "",
    content: typeof item.content === "string" ? item.content : "",
    createdAt,
    updatedAt,
  };
}

function normalizeInboxDigestTombstone(input: unknown): InboxDigestTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return { id, updatedAt, deletedAt };
}

function isInboxDigestTombstone(entry: InboxDigestStoreEntry): entry is InboxDigestTombstone {
  return "deletedAt" in entry;
}

function normalizeInboxDigestEntry(input: unknown): InboxDigestStoreEntry | null {
  return normalizeInboxDigestTombstone(input) ?? normalizeInboxDigest(input);
}

function normalizeInboxDigestEntries(raw: unknown): InboxDigestStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, InboxDigestStoreEntry>();
  for (const item of raw) {
    const entry = normalizeInboxDigestEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isInboxDigestTombstone(existing) &&
      isInboxDigestTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_DIGESTS);
}

function liveInboxDigests(entries: InboxDigestStoreEntry[]) {
  return entries.filter((entry): entry is InboxDigest => !isInboxDigestTombstone(entry));
}

function inboxDigestTombstones(entries: InboxDigestStoreEntry[]) {
  return entries.filter(isInboxDigestTombstone);
}

export async function listInboxItemStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(ITEM_FILE_NAME, []);
  const entries = normalizeInboxItemEntries(raw);
  return {
    items: liveInboxItems(entries),
    tombstones: inboxItemTombstones(entries),
  };
}

export async function writeInboxItemsToStore(input: unknown) {
  const normalized = liveInboxItems(normalizeInboxItemEntries(input));
  await writeJsonFile(ITEM_FILE_NAME, normalized);
  return normalized;
}

export async function upsertInboxItemInStore(input: unknown) {
  const candidate = normalizeInboxItem(input);
  if (!candidate) {
    return { item: null, tombstone: null, accepted: false };
  }

  let storedItem: InboxItem | null = candidate;
  let storedTombstone: InboxItemTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(ITEM_FILE_NAME, [], (current) => {
    const entries = normalizeInboxItemEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isInboxItemTombstone(existing)))
    ) {
      accepted = false;
      if (isInboxItemTombstone(existing)) {
        storedItem = null;
        storedTombstone = existing;
      } else {
        storedItem = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedItem =
      next.find((entry): entry is InboxItem => entry.id === candidate.id && !isInboxItemTombstone(entry)) ??
      candidate;
    storedTombstone = null;
    return next;
  });

  return { item: storedItem, tombstone: storedTombstone, accepted };
}

export async function removeInboxItemFromStore(itemId: string, updatedAt?: number | null) {
  const normalizedId = itemId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, item: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentItem: InboxItem | null = null;
  let currentTombstone: InboxItemTombstone | null = null;

  await readModifyWrite<unknown[]>(ITEM_FILE_NAME, [], (current) => {
    const entries = normalizeInboxItemEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = { id: normalizedId, updatedAt: deletedAt, deletedAt };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_ITEMS);
    }

    if (isInboxItemTombstone(existing)) {
      currentTombstone = existing;
      if (
        typeof updatedAt === "number" &&
        Number.isFinite(updatedAt) &&
        existing.updatedAt > updatedAt
      ) {
        conflict = true;
      }
      return entries;
    }

    currentItem = existing;
    if (
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt) &&
      existing.updatedAt > updatedAt
    ) {
      conflict = true;
      return entries;
    }

    const deletedAt = Date.now();
    currentTombstone = { id: normalizedId, updatedAt: deletedAt, deletedAt };
    removed = true;
    return [currentTombstone, ...entries.filter((entry) => entry.id !== normalizedId)].slice(
      0,
      MAX_ITEMS,
    );
  });

  return { removed, conflict, item: currentItem, tombstone: currentTombstone };
}

export async function listInboxDigestStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(DIGEST_FILE_NAME, []);
  const entries = normalizeInboxDigestEntries(raw);
  return {
    digests: liveInboxDigests(entries),
    tombstones: inboxDigestTombstones(entries),
  };
}

export async function writeInboxDigestsToStore(input: unknown) {
  const normalized = liveInboxDigests(normalizeInboxDigestEntries(input));
  await writeJsonFile(DIGEST_FILE_NAME, normalized);
  return normalized;
}

export async function upsertInboxDigestInStore(input: unknown) {
  const candidate = normalizeInboxDigest(input);
  if (!candidate) {
    return { digest: null, tombstone: null, accepted: false };
  }

  let storedDigest: InboxDigest | null = candidate;
  let storedTombstone: InboxDigestTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(DIGEST_FILE_NAME, [], (current) => {
    const entries = normalizeInboxDigestEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isInboxDigestTombstone(existing)))
    ) {
      accepted = false;
      if (isInboxDigestTombstone(existing)) {
        storedDigest = null;
        storedTombstone = existing;
      } else {
        storedDigest = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_DIGESTS);
    storedDigest =
      next.find((entry): entry is InboxDigest => entry.id === candidate.id && !isInboxDigestTombstone(entry)) ??
      candidate;
    storedTombstone = null;
    return next;
  });

  return { digest: storedDigest, tombstone: storedTombstone, accepted };
}

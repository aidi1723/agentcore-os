import type { SupportAssetRecord, SupportAssetStatus } from "@/lib/support-assets";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "support-assets.json";
const MAX_ITEMS = 240;
const STATUSES = new Set<SupportAssetStatus>([
  "capture",
  "replying",
  "followup",
  "faq",
  "completed",
]);

export type SupportAssetStoreTombstone = {
  id: string;
  workflowRunId: string;
  updatedAt: number;
  deletedAt: number;
};

type SupportAssetStoreEntry = SupportAssetRecord | SupportAssetStoreTombstone;

function normalizeSupportAsset(input: unknown): SupportAssetRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const workflowRunId =
    typeof item.workflowRunId === "string" && item.workflowRunId.trim()
      ? item.workflowRunId.trim()
      : null;
  if (!id || !workflowRunId) return null;
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
    workflowRunId,
    scenarioId:
      typeof item.scenarioId === "string" && item.scenarioId.trim()
        ? item.scenarioId
        : "support-ops",
    inboxItemId: typeof item.inboxItemId === "string" ? item.inboxItemId : undefined,
    ticketId: typeof item.ticketId === "string" ? item.ticketId : undefined,
    customer: typeof item.customer === "string" ? item.customer : "",
    channel: typeof item.channel === "string" ? item.channel : "",
    issueSummary: typeof item.issueSummary === "string" ? item.issueSummary : "",
    latestDigest: typeof item.latestDigest === "string" ? item.latestDigest : "",
    latestReply: typeof item.latestReply === "string" ? item.latestReply : "",
    escalationTask: typeof item.escalationTask === "string" ? item.escalationTask : "",
    faqDraft: typeof item.faqDraft === "string" ? item.faqDraft : "",
    nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as SupportAssetStatus)
        ? (item.status as SupportAssetStatus)
        : "capture",
    createdAt,
    updatedAt,
  };
}

function normalizeSupportAssetTombstone(input: unknown): SupportAssetStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const workflowRunId =
    typeof item.workflowRunId === "string" && item.workflowRunId.trim()
      ? item.workflowRunId.trim()
      : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || !workflowRunId || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return { id, workflowRunId, updatedAt, deletedAt };
}

function isSupportAssetTombstone(
  entry: SupportAssetStoreEntry,
): entry is SupportAssetStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): SupportAssetStoreEntry | null {
  return normalizeSupportAssetTombstone(input) ?? normalizeSupportAsset(input);
}

function compareSupportAssetPriority(left: SupportAssetRecord, right: SupportAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): SupportAssetStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, SupportAssetStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = byId.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      byId.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isSupportAssetTombstone(existing) &&
      isSupportAssetTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveByWorkflowRun = new Map<string, SupportAssetRecord>();
  for (const entry of byId.values()) {
    if (isSupportAssetTombstone(entry)) continue;
    const existing = liveByWorkflowRun.get(entry.workflowRunId);
    if (!existing || compareSupportAssetPriority(existing, entry) < 0) {
      liveByWorkflowRun.set(entry.workflowRunId, entry);
    }
  }

  const next: SupportAssetStoreEntry[] = [];
  const tombstones = new Map<string, SupportAssetStoreTombstone>();

  for (const entry of byId.values()) {
    if (isSupportAssetTombstone(entry)) {
      const existing = tombstones.get(entry.id);
      if (!existing || existing.updatedAt <= entry.updatedAt) {
        tombstones.set(entry.id, entry);
      }
      continue;
    }
    const activeWorkflowAsset = liveByWorkflowRun.get(entry.workflowRunId);
    if (activeWorkflowAsset?.id === entry.id) {
      next.push(entry);
      continue;
    }
    const deletedAt = Math.max(entry.updatedAt, activeWorkflowAsset?.updatedAt ?? entry.updatedAt);
    const tombstone: SupportAssetStoreTombstone = {
      id: entry.id,
      workflowRunId: entry.workflowRunId,
      updatedAt: deletedAt,
      deletedAt,
    };
    const existing = tombstones.get(entry.id);
    if (!existing || existing.updatedAt <= tombstone.updatedAt) {
      tombstones.set(entry.id, tombstone);
    }
  }

  return [...next, ...tombstones.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveSupportAssets(entries: SupportAssetStoreEntry[]) {
  return entries.filter((entry): entry is SupportAssetRecord => !isSupportAssetTombstone(entry));
}

function supportAssetTombstones(entries: SupportAssetStoreEntry[]) {
  return entries.filter(isSupportAssetTombstone);
}

export async function listSupportAssetStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    supportAssets: liveSupportAssets(entries),
    tombstones: supportAssetTombstones(entries),
  };
}

export async function writeSupportAssetsToStore(input: unknown) {
  const normalized = liveSupportAssets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertSupportAssetInStore(input: unknown) {
  const candidate = normalizeSupportAsset(input);
  if (!candidate) {
    return { supportAsset: null, tombstone: null, accepted: false };
  }

  let storedSupportAsset: SupportAssetRecord | null = candidate;
  let storedTombstone: SupportAssetStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existingById = entries.find((entry) => entry.id === candidate.id) ?? null;
    const existingByWorkflow = entries.find(
      (entry): entry is SupportAssetRecord =>
        !isSupportAssetTombstone(entry) && entry.workflowRunId === candidate.workflowRunId,
    ) ?? null;

    if (
      existingById &&
      (existingById.updatedAt > candidate.updatedAt ||
        (existingById.updatedAt === candidate.updatedAt &&
          isSupportAssetTombstone(existingById)))
    ) {
      accepted = false;
      if (isSupportAssetTombstone(existingById)) {
        storedSupportAsset = null;
        storedTombstone = existingById;
      } else {
        storedSupportAsset = existingById;
      }
      return entries;
    }

    if (
      existingByWorkflow &&
      existingByWorkflow.id !== candidate.id &&
      compareSupportAssetPriority(candidate, existingByWorkflow) <= 0
    ) {
      accepted = false;
      storedSupportAsset = existingByWorkflow;
      storedTombstone = null;
      return entries;
    }

    const replacedEntry =
      existingByWorkflow && existingByWorkflow.id !== candidate.id ? existingByWorkflow : null;
    const replacementTombstone =
      replacedEntry === null
        ? null
        : ({
            id: replacedEntry.id,
            workflowRunId: replacedEntry.workflowRunId,
            updatedAt: candidate.updatedAt,
            deletedAt: candidate.updatedAt,
          } satisfies SupportAssetStoreTombstone);

    const next = [
      candidate,
      ...(replacementTombstone ? [replacementTombstone] : []),
      ...entries.filter(
        (entry) => entry.id !== candidate.id && entry.id !== replacedEntry?.id,
      ),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);

    storedSupportAsset =
      next.find(
        (entry): entry is SupportAssetRecord =>
          entry.id === candidate.id && !isSupportAssetTombstone(entry),
      ) ?? candidate;
    storedTombstone = replacementTombstone;
    return next;
  });

  return { supportAsset: storedSupportAsset, tombstone: storedTombstone, accepted };
}

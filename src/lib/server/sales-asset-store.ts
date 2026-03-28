import type { SalesAssetRecord, SalesAssetStatus } from "@/lib/sales-assets";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "sales-assets.json";
const MAX_ITEMS = 240;
const STATUSES = new Set<SalesAssetStatus>([
  "qualifying",
  "awaiting_review",
  "crm_syncing",
  "completed",
]);

export type SalesAssetStoreTombstone = {
  id: string;
  workflowRunId: string;
  updatedAt: number;
  deletedAt: number;
};

type SalesAssetStoreEntry = SalesAssetRecord | SalesAssetStoreTombstone;

function normalizeSalesAsset(input: unknown): SalesAssetRecord | null {
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
        : "sales-pipeline",
    dealId: typeof item.dealId === "string" ? item.dealId : undefined,
    emailThreadId: typeof item.emailThreadId === "string" ? item.emailThreadId : undefined,
    contactId: typeof item.contactId === "string" ? item.contactId : undefined,
    company: typeof item.company === "string" ? item.company : "",
    contactName: typeof item.contactName === "string" ? item.contactName : "",
    inquiryChannel: typeof item.inquiryChannel === "string" ? item.inquiryChannel : "",
    preferredLanguage:
      typeof item.preferredLanguage === "string" ? item.preferredLanguage : "",
    productLine: typeof item.productLine === "string" ? item.productLine : "",
    requirementSummary:
      typeof item.requirementSummary === "string" ? item.requirementSummary : "",
    preferenceNotes:
      typeof item.preferenceNotes === "string" ? item.preferenceNotes : "",
    objectionNotes:
      typeof item.objectionNotes === "string" ? item.objectionNotes : "",
    nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
    quoteNotes: typeof item.quoteNotes === "string" ? item.quoteNotes : "",
    quoteStatus: typeof item.quoteStatus === "string" ? item.quoteStatus : "not_started",
    latestDraftSubject:
      typeof item.latestDraftSubject === "string" ? item.latestDraftSubject : "",
    latestDraftBody: typeof item.latestDraftBody === "string" ? item.latestDraftBody : "",
    assetDraft: typeof item.assetDraft === "string" ? item.assetDraft : "",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as SalesAssetStatus)
        ? (item.status as SalesAssetStatus)
        : "qualifying",
    createdAt,
    updatedAt,
  };
}

function normalizeSalesAssetTombstone(input: unknown): SalesAssetStoreTombstone | null {
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

function isSalesAssetTombstone(entry: SalesAssetStoreEntry): entry is SalesAssetStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): SalesAssetStoreEntry | null {
  return normalizeSalesAssetTombstone(input) ?? normalizeSalesAsset(input);
}

function compareSalesAssetPriority(left: SalesAssetRecord, right: SalesAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): SalesAssetStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, SalesAssetStoreEntry>();
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
      !isSalesAssetTombstone(existing) &&
      isSalesAssetTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveByWorkflowRun = new Map<string, SalesAssetRecord>();
  for (const entry of byId.values()) {
    if (isSalesAssetTombstone(entry)) continue;
    const existing = liveByWorkflowRun.get(entry.workflowRunId);
    if (!existing || compareSalesAssetPriority(existing, entry) < 0) {
      liveByWorkflowRun.set(entry.workflowRunId, entry);
    }
  }

  const next: SalesAssetStoreEntry[] = [];
  const tombstones = new Map<string, SalesAssetStoreTombstone>();

  for (const entry of byId.values()) {
    if (isSalesAssetTombstone(entry)) {
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
    const tombstone: SalesAssetStoreTombstone = {
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

function liveSalesAssets(entries: SalesAssetStoreEntry[]) {
  return entries.filter((entry): entry is SalesAssetRecord => !isSalesAssetTombstone(entry));
}

function salesAssetTombstones(entries: SalesAssetStoreEntry[]) {
  return entries.filter(isSalesAssetTombstone);
}

export async function listSalesAssetStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    salesAssets: liveSalesAssets(entries),
    tombstones: salesAssetTombstones(entries),
  };
}

export async function writeSalesAssetsToStore(input: unknown) {
  const normalized = liveSalesAssets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertSalesAssetInStore(input: unknown) {
  const candidate = normalizeSalesAsset(input);
  if (!candidate) {
    return { salesAsset: null, tombstone: null, accepted: false };
  }

  let storedSalesAsset: SalesAssetRecord | null = candidate;
  let storedTombstone: SalesAssetStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existingById = entries.find((entry) => entry.id === candidate.id) ?? null;
    const existingByWorkflow = entries.find(
      (entry): entry is SalesAssetRecord =>
        !isSalesAssetTombstone(entry) && entry.workflowRunId === candidate.workflowRunId,
    ) ?? null;

    if (
      existingById &&
      (existingById.updatedAt > candidate.updatedAt ||
        (existingById.updatedAt === candidate.updatedAt &&
          isSalesAssetTombstone(existingById)))
    ) {
      accepted = false;
      if (isSalesAssetTombstone(existingById)) {
        storedSalesAsset = null;
        storedTombstone = existingById;
      } else {
        storedSalesAsset = existingById;
      }
      return entries;
    }

    if (
      existingByWorkflow &&
      existingByWorkflow.id !== candidate.id &&
      compareSalesAssetPriority(candidate, existingByWorkflow) <= 0
    ) {
      accepted = false;
      storedSalesAsset = existingByWorkflow;
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
          } satisfies SalesAssetStoreTombstone);

    const next = [
      candidate,
      ...(replacementTombstone ? [replacementTombstone] : []),
      ...entries.filter(
        (entry) => entry.id !== candidate.id && entry.id !== replacedEntry?.id,
      ),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);

    storedSalesAsset =
      next.find(
        (entry): entry is SalesAssetRecord =>
          entry.id === candidate.id && !isSalesAssetTombstone(entry),
      ) ?? candidate;
    storedTombstone = replacementTombstone;
    return next;
  });

  return { salesAsset: storedSalesAsset, tombstone: storedTombstone, accepted };
}

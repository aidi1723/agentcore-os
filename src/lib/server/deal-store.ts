import type { DealRecord, DealStage } from "@/lib/deals";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "deals.json";
const MAX_ITEMS = 240;
const STAGES = new Set<DealStage>(["new", "qualified", "proposal", "blocked", "won"]);

export type DealStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type DealStoreEntry = DealRecord | DealStoreTombstone;

function normalizeDeal(input: unknown): DealRecord | null {
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
    company: typeof item.company === "string" ? item.company : "新线索",
    contact: typeof item.contact === "string" ? item.contact : "",
    inquiryChannel: typeof item.inquiryChannel === "string" ? item.inquiryChannel : "",
    preferredLanguage: typeof item.preferredLanguage === "string" ? item.preferredLanguage : "",
    productLine: typeof item.productLine === "string" ? item.productLine : "",
    need: typeof item.need === "string" ? item.need : "",
    budget: typeof item.budget === "string" ? item.budget : "",
    timing: typeof item.timing === "string" ? item.timing : "",
    stage:
      typeof item.stage === "string" && STAGES.has(item.stage as DealStage)
        ? (item.stage as DealStage)
        : "new",
    notes: typeof item.notes === "string" ? item.notes : "",
    brief: typeof item.brief === "string" ? item.brief : "",
    reviewNotes: typeof item.reviewNotes === "string" ? item.reviewNotes : "",
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

function normalizeDealTombstone(input: unknown): DealStoreTombstone | null {
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
  return {
    id,
    updatedAt,
    deletedAt,
  };
}

function isDealTombstone(entry: DealStoreEntry): entry is DealStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): DealStoreEntry | null {
  return normalizeDealTombstone(input) ?? normalizeDeal(input);
}

function normalizeEntries(raw: unknown): DealStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, DealStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isDealTombstone(existing) &&
      isDealTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveDeals(entries: DealStoreEntry[]) {
  return entries.filter((entry): entry is DealRecord => !isDealTombstone(entry));
}

function dealTombstones(entries: DealStoreEntry[]) {
  return entries.filter(isDealTombstone);
}

export async function listDealsFromStore() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return liveDeals(normalizeEntries(raw));
}

export async function listDealStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    deals: liveDeals(entries),
    tombstones: dealTombstones(entries),
  };
}

export async function writeDealsToStore(input: unknown) {
  const normalized = liveDeals(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertDealInStore(input: unknown) {
  const candidate = normalizeDeal(input);
  if (!candidate) {
    return { deal: null, accepted: false };
  }

  let storedDeal: DealRecord | null = candidate;
  let storedTombstone: DealStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isDealTombstone(existing)))
    ) {
      accepted = false;
      if (isDealTombstone(existing)) {
        storedDeal = null;
        storedTombstone = existing;
      } else {
        storedDeal = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedDeal =
      next.find((entry): entry is DealRecord => entry.id === candidate.id && !isDealTombstone(entry)) ??
      candidate;
    storedTombstone = null;
    return next;
  });

  return { deal: storedDeal, tombstone: storedTombstone, accepted };
}

export async function removeDealFromStore(dealId: string, updatedAt?: number | null) {
  const normalizedId = dealId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, deal: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentDeal: DealRecord | null = null;
  let currentTombstone: DealStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = {
        id: normalizedId,
        updatedAt: deletedAt,
        deletedAt,
      };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_ITEMS);
    }

    if (isDealTombstone(existing)) {
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

    currentDeal = existing;

    if (
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt) &&
      existing.updatedAt > updatedAt
    ) {
      conflict = true;
      return entries;
    }

    const deletedAt = Date.now();
    currentTombstone = {
      id: normalizedId,
      updatedAt: deletedAt,
      deletedAt,
    };
    removed = true;
    return [currentTombstone, ...entries.filter((entry) => entry.id !== normalizedId)].slice(
      0,
      MAX_ITEMS,
    );
  });

  return {
    removed,
    conflict,
    deal: currentDeal,
    tombstone: currentTombstone,
  };
}

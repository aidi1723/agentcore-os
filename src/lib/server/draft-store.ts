import type { DraftRecord, DraftSource } from "@/lib/drafts";
import type { PublishPlatformId } from "@/lib/publish";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";

const FILE_NAME = "drafts.json";
const MAX_ITEMS = 400;
const SOURCES = new Set<DraftSource>(["media_ops", "publisher", "import"]);
const PUBLISH_PLATFORMS = new Set<PublishPlatformId>([
  "xiaohongshu",
  "douyin",
  "wechat",
  "tiktok",
  "instagram",
  "twitter",
  "linkedin",
  "storefront",
]);
const TRIGGERS = new Set<WorkflowTriggerType>([
  "manual",
  "schedule",
  "inbound_message",
  "web_form",
]);

export type DraftStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type DraftStoreEntry = DraftRecord | DraftStoreTombstone;

function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return undefined;
  const tags = input
    .filter((item): item is string => typeof item === "string")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 24);
  return tags.length > 0 ? tags : undefined;
}

function normalizeText(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

function normalizeSuggestedPlatforms(input: unknown) {
  if (!Array.isArray(input)) return undefined;
  const platforms: PublishPlatformId[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const platform = item.trim() as PublishPlatformId;
    if (!PUBLISH_PLATFORMS.has(platform) || platforms.includes(platform)) continue;
    platforms.push(platform);
  }
  return platforms.length > 0 ? platforms : undefined;
}

function normalizeDraft(input: unknown): DraftRecord | null {
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
    title:
      typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名草稿",
    body: typeof item.body === "string" ? item.body : "",
    tags: normalizeTags(item.tags),
    source:
      typeof item.source === "string" && SOURCES.has(item.source as DraftSource)
        ? (item.source as DraftSource)
        : "publisher",
    workflowRunId: typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    workflowScenarioId:
      typeof item.workflowScenarioId === "string" ? item.workflowScenarioId : undefined,
    workflowStageId: normalizeText(item.workflowStageId),
    workflowSource: normalizeText(item.workflowSource),
    workflowNextStep: normalizeText(item.workflowNextStep),
    workflowTriggerType:
      typeof item.workflowTriggerType === "string" &&
      TRIGGERS.has(item.workflowTriggerType as WorkflowTriggerType)
        ? (item.workflowTriggerType as WorkflowTriggerType)
        : undefined,
    workflowOriginApp:
      item.workflowOriginApp === "creator_radar" ||
      item.workflowOriginApp === "content_repurposer" ||
      item.workflowOriginApp === "publisher"
        ? item.workflowOriginApp
        : undefined,
    workflowOriginId: normalizeText(item.workflowOriginId),
    workflowOriginLabel: normalizeText(item.workflowOriginLabel),
    workflowAudience: normalizeText(item.workflowAudience),
    workflowPrimaryAngle: normalizeText(item.workflowPrimaryAngle),
    workflowSourceSummary: normalizeText(item.workflowSourceSummary),
    workflowBlockLabel: normalizeText(item.workflowBlockLabel),
    workflowSuggestedPlatforms: normalizeSuggestedPlatforms(item.workflowSuggestedPlatforms),
    workflowPublishNotes: normalizeText(item.workflowPublishNotes),
    createdAt,
    updatedAt,
  };
}

function normalizeDraftTombstone(input: unknown): DraftStoreTombstone | null {
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

function isDraftTombstone(entry: DraftStoreEntry): entry is DraftStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): DraftStoreEntry | null {
  return normalizeDraftTombstone(input) ?? normalizeDraft(input);
}

function normalizeEntries(raw: unknown): DraftStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, DraftStoreEntry>();
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
      !isDraftTombstone(existing) &&
      isDraftTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveDrafts(entries: DraftStoreEntry[]) {
  return entries.filter((entry): entry is DraftRecord => !isDraftTombstone(entry));
}

function draftTombstones(entries: DraftStoreEntry[]) {
  return entries.filter(isDraftTombstone);
}

export async function listDraftsFromStore() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return liveDrafts(normalizeEntries(raw));
}

export async function listDraftStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    drafts: liveDrafts(entries),
    tombstones: draftTombstones(entries),
  };
}

export async function writeDraftsToStore(input: unknown) {
  const normalized = liveDrafts(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertDraftInStore(input: unknown) {
  const candidate = normalizeDraft(input);
  if (!candidate) {
    return { draft: null, accepted: false };
  }

  let storedDraft: DraftRecord | null = candidate;
  let storedTombstone: DraftStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isDraftTombstone(existing)))
    ) {
      accepted = false;
      if (isDraftTombstone(existing)) {
        storedDraft = null;
        storedTombstone = existing;
      } else {
        storedDraft = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedDraft =
      next.find(
        (entry): entry is DraftRecord =>
          entry.id === candidate.id && !isDraftTombstone(entry),
      ) ?? candidate;
    storedTombstone = null;
    return next;
  });

  return { draft: storedDraft, tombstone: storedTombstone, accepted };
}

export async function removeDraftFromStore(draftId: string, updatedAt?: number | null) {
  const normalizedId = draftId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, draft: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentDraft: DraftRecord | null = null;
  let currentTombstone: DraftStoreTombstone | null = null;

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

    if (isDraftTombstone(existing)) {
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

    currentDraft = existing;

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
    draft: currentDraft,
    tombstone: currentTombstone,
  };
}

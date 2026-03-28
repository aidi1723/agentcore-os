import type { AssetJumpTarget } from "@/lib/asset-jumps";
import type {
  KnowledgeAssetRecord,
  KnowledgeAssetStatus,
  KnowledgeAssetType,
} from "@/lib/knowledge-assets";
import type { PublishPlatformId } from "@/lib/publish";
import type { PublisherPrefill } from "@/lib/ui-events";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "knowledge-assets.json";
const MAX_ITEMS = 320;
const ASSET_TYPES = new Set<KnowledgeAssetType>(["sales_playbook", "support_faq"]);
const STATUSES = new Set<KnowledgeAssetStatus>(["active", "archived"]);
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

export type KnowledgeAssetStoreTombstone = {
  id: string;
  sourceKey: string;
  updatedAt: number;
  deletedAt: number;
};

type KnowledgeAssetStoreEntry = KnowledgeAssetRecord | KnowledgeAssetStoreTombstone;

function clipText(value: string, limit: number) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(1, limit - 1))}…`;
}

function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 24);
}

function normalizePublisherPrefill(input: unknown): PublisherPrefill | undefined {
  if (!input || typeof input !== "object") return undefined;
  const item = input as Record<string, unknown>;
  const platforms = Array.isArray(item.platforms)
    ? item.platforms.filter(
        (value): value is PublishPlatformId =>
          typeof value === "string" &&
          PUBLISH_PLATFORMS.has(value as PublishPlatformId),
      )
    : undefined;
  return {
    draftId: typeof item.draftId === "string" ? item.draftId : undefined,
    title: typeof item.title === "string" ? item.title : undefined,
    body: typeof item.body === "string" ? item.body : undefined,
    platforms,
    dispatchMode: item.dispatchMode === "dispatch" ? "dispatch" : "dry-run",
    workflowSource:
      typeof item.workflowSource === "string" ? item.workflowSource : undefined,
    workflowNextStep:
      typeof item.workflowNextStep === "string" ? item.workflowNextStep : undefined,
    workflowRunId:
      typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    workflowScenarioId:
      typeof item.workflowScenarioId === "string" ? item.workflowScenarioId : undefined,
    workflowStageId:
      typeof item.workflowStageId === "string" ? item.workflowStageId : undefined,
    workflowTriggerType:
      item.workflowTriggerType === "manual" ||
      item.workflowTriggerType === "schedule" ||
      item.workflowTriggerType === "inbound_message" ||
      item.workflowTriggerType === "web_form"
        ? item.workflowTriggerType
        : undefined,
  };
}

function normalizeJumpTarget(input: unknown): AssetJumpTarget | undefined {
  if (!input || typeof input !== "object") return undefined;
  const item = input as Record<string, unknown>;
  if (item.kind === "record") {
    const appId = typeof item.appId === "string" ? item.appId : null;
    const eventName = typeof item.eventName === "string" ? item.eventName : null;
    const detail =
      item.eventDetail && typeof item.eventDetail === "object"
        ? Object.fromEntries(
            Object.entries(item.eventDetail as Record<string, unknown>)
              .filter(([, value]) => typeof value === "string" || value === undefined)
              .map(([key, value]) => [key, value as string | undefined]),
          )
        : {};
    if (!appId || !eventName) return undefined;
    return {
      kind: "record",
      appId: appId as AssetJumpTarget extends { kind: "record"; appId: infer T } ? T : never,
      eventName,
      eventDetail: detail,
    };
  }
  if (item.kind === "publisher") {
    const prefill = normalizePublisherPrefill(item.prefill);
    return prefill ? { kind: "publisher", prefill } : undefined;
  }
  return undefined;
}

function normalizeKnowledgeAsset(input: unknown): KnowledgeAssetRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const sourceKey =
    typeof item.sourceKey === "string" && item.sourceKey.trim() ? item.sourceKey.trim() : null;
  if (!id || !sourceKey) return null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;
  const sourceApp =
    item.sourceApp === "support_copilot" ? "support_copilot" : "personal_crm";
  return {
    id,
    sourceKey,
    title:
      typeof item.title === "string" && item.title.trim()
        ? clipText(item.title, 240)
        : "未命名知识资产",
    body: typeof item.body === "string" ? clipText(item.body, 24_000) : "",
    sourceApp,
    scenarioId:
      typeof item.scenarioId === "string" && item.scenarioId.trim()
        ? item.scenarioId
        : "general",
    workflowRunId: typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    assetType:
      typeof item.assetType === "string" && ASSET_TYPES.has(item.assetType as KnowledgeAssetType)
        ? (item.assetType as KnowledgeAssetType)
        : "sales_playbook",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as KnowledgeAssetStatus)
        ? (item.status as KnowledgeAssetStatus)
        : "active",
    tags: normalizeTags(item.tags),
    applicableScene:
      typeof item.applicableScene === "string" && item.applicableScene.trim()
        ? clipText(item.applicableScene, 240)
        : "未指定场景",
    reuseCount:
      typeof item.reuseCount === "number" && Number.isFinite(item.reuseCount)
        ? Math.max(0, Math.floor(item.reuseCount))
        : 0,
    sourceJumpTarget: normalizeJumpTarget(item.sourceJumpTarget),
    createdAt,
    updatedAt,
  };
}

function normalizeKnowledgeAssetTombstone(
  input: unknown,
): KnowledgeAssetStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const sourceKey =
    typeof item.sourceKey === "string" && item.sourceKey.trim() ? item.sourceKey.trim() : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || !sourceKey || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return {
    id,
    sourceKey,
    updatedAt,
    deletedAt,
  };
}

function isKnowledgeAssetTombstone(
  entry: KnowledgeAssetStoreEntry,
): entry is KnowledgeAssetStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): KnowledgeAssetStoreEntry | null {
  return normalizeKnowledgeAssetTombstone(input) ?? normalizeKnowledgeAsset(input);
}

function compareKnowledgeAssetPriority(
  left: KnowledgeAssetRecord,
  right: KnowledgeAssetRecord,
) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): KnowledgeAssetStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, KnowledgeAssetStoreEntry>();
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
      !isKnowledgeAssetTombstone(existing) &&
      isKnowledgeAssetTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveBySourceKey = new Map<string, KnowledgeAssetRecord>();
  for (const entry of byId.values()) {
    if (isKnowledgeAssetTombstone(entry)) continue;
    const existing = liveBySourceKey.get(entry.sourceKey);
    if (!existing || compareKnowledgeAssetPriority(existing, entry) < 0) {
      liveBySourceKey.set(entry.sourceKey, entry);
    }
  }

  const next: KnowledgeAssetStoreEntry[] = [];
  const tombstones = new Map<string, KnowledgeAssetStoreTombstone>();

  for (const entry of byId.values()) {
    if (isKnowledgeAssetTombstone(entry)) {
      const existing = tombstones.get(entry.id);
      if (!existing || existing.updatedAt <= entry.updatedAt) {
        tombstones.set(entry.id, entry);
      }
      continue;
    }

    const activeSourceAsset = liveBySourceKey.get(entry.sourceKey);
    if (activeSourceAsset?.id === entry.id) {
      next.push(entry);
      continue;
    }

    const deletedAt = Math.max(entry.updatedAt, activeSourceAsset?.updatedAt ?? entry.updatedAt);
    const tombstone: KnowledgeAssetStoreTombstone = {
      id: entry.id,
      sourceKey: entry.sourceKey,
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

function liveKnowledgeAssets(entries: KnowledgeAssetStoreEntry[]) {
  return entries.filter(
    (entry): entry is KnowledgeAssetRecord => !isKnowledgeAssetTombstone(entry),
  );
}

function knowledgeAssetTombstones(entries: KnowledgeAssetStoreEntry[]) {
  return entries.filter(isKnowledgeAssetTombstone);
}

export async function listKnowledgeAssetsFromStore() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return liveKnowledgeAssets(normalizeEntries(raw));
}

export async function listKnowledgeAssetStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    knowledgeAssets: liveKnowledgeAssets(entries),
    tombstones: knowledgeAssetTombstones(entries),
  };
}

export async function writeKnowledgeAssetsToStore(input: unknown) {
  const normalized = liveKnowledgeAssets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertKnowledgeAssetInStore(input: unknown) {
  const candidate = normalizeKnowledgeAsset(input);
  if (!candidate) {
    return { knowledgeAsset: null, tombstone: null, accepted: false };
  }

  let storedKnowledgeAsset: KnowledgeAssetRecord | null = candidate;
  let storedTombstone: KnowledgeAssetStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existingById = entries.find((entry) => entry.id === candidate.id) ?? null;
    const existingBySourceKey = entries.find(
      (entry): entry is KnowledgeAssetRecord =>
        !isKnowledgeAssetTombstone(entry) && entry.sourceKey === candidate.sourceKey,
    ) ?? null;

    if (
      existingById &&
      (existingById.updatedAt > candidate.updatedAt ||
        (existingById.updatedAt === candidate.updatedAt &&
          isKnowledgeAssetTombstone(existingById)))
    ) {
      accepted = false;
      if (isKnowledgeAssetTombstone(existingById)) {
        storedKnowledgeAsset = null;
        storedTombstone = existingById;
      } else {
        storedKnowledgeAsset = existingById;
      }
      return entries;
    }

    if (
      existingBySourceKey &&
      existingBySourceKey.id !== candidate.id &&
      compareKnowledgeAssetPriority(candidate, existingBySourceKey) <= 0
    ) {
      accepted = false;
      storedKnowledgeAsset = existingBySourceKey;
      storedTombstone = null;
      return entries;
    }

    const replacedSourceEntry =
      existingBySourceKey && existingBySourceKey.id !== candidate.id
        ? existingBySourceKey
        : null;
    const replacementTombstone =
      replacedSourceEntry === null
        ? null
        : ({
            id: replacedSourceEntry.id,
            sourceKey: replacedSourceEntry.sourceKey,
            updatedAt: candidate.updatedAt,
            deletedAt: candidate.updatedAt,
          } satisfies KnowledgeAssetStoreTombstone);

    const next = [
      candidate,
      ...(replacementTombstone ? [replacementTombstone] : []),
      ...entries.filter(
        (entry) =>
          entry.id !== candidate.id &&
          entry.id !== replacedSourceEntry?.id,
      ),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);

    storedKnowledgeAsset =
      next.find(
        (entry): entry is KnowledgeAssetRecord =>
          entry.id === candidate.id && !isKnowledgeAssetTombstone(entry),
      ) ?? candidate;
    storedTombstone = replacementTombstone;
    return next;
  });

  return {
    knowledgeAsset: storedKnowledgeAsset,
    tombstone: storedTombstone,
    accepted,
  };
}

export async function removeKnowledgeAssetFromStore(
  assetId: string,
  updatedAt?: number | null,
) {
  const normalizedId = assetId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, knowledgeAsset: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentKnowledgeAsset: KnowledgeAssetRecord | null = null;
  let currentTombstone: KnowledgeAssetStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = {
        id: normalizedId,
        sourceKey: normalizedId,
        updatedAt: deletedAt,
        deletedAt,
      };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_ITEMS);
    }

    if (isKnowledgeAssetTombstone(existing)) {
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

    currentKnowledgeAsset = existing;

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
      sourceKey: existing.sourceKey,
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
    knowledgeAsset: currentKnowledgeAsset,
    tombstone: currentTombstone,
  };
}

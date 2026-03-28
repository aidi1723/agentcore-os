import type { CreatorAssetRecord, CreatorAssetStatus } from "@/lib/creator-assets";
import type { PublishPlatformId } from "@/lib/publish";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "creator-assets.json";
const MAX_ITEMS = 240;
const STATUSES = new Set<CreatorAssetStatus>([
  "radar",
  "repurposing",
  "preflight",
  "publishing",
  "completed",
]);

export type CreatorAssetStoreTombstone = {
  id: string;
  workflowRunId: string;
  updatedAt: number;
  deletedAt: number;
};

type CreatorAssetStoreEntry = CreatorAssetRecord | CreatorAssetStoreTombstone;

function normalizePublishTargets(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is PublishPlatformId => typeof item === "string").slice(0, 24);
}

function normalizeCreatorAsset(input: unknown): CreatorAssetRecord | null {
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
        : "creator-studio",
    radarItemId: typeof item.radarItemId === "string" ? item.radarItemId : undefined,
    repurposerProjectId:
      typeof item.repurposerProjectId === "string" ? item.repurposerProjectId : undefined,
    draftId: typeof item.draftId === "string" ? item.draftId : undefined,
    topic: typeof item.topic === "string" ? item.topic : "",
    audience: typeof item.audience === "string" ? item.audience : "",
    sourceChannels: typeof item.sourceChannels === "string" ? item.sourceChannels : "",
    primaryAngle: typeof item.primaryAngle === "string" ? item.primaryAngle : "",
    latestDigest: typeof item.latestDigest === "string" ? item.latestDigest : "",
    latestPack: typeof item.latestPack === "string" ? item.latestPack : "",
    latestDraftTitle:
      typeof item.latestDraftTitle === "string" ? item.latestDraftTitle : "",
    latestDraftBody:
      typeof item.latestDraftBody === "string" ? item.latestDraftBody : "",
    publishTargets: normalizePublishTargets(item.publishTargets),
    publishStatus: typeof item.publishStatus === "string" ? item.publishStatus : "not_started",
    latestPublishFeedback:
      typeof item.latestPublishFeedback === "string" ? item.latestPublishFeedback : "",
    successfulPlatforms: normalizePublishTargets(item.successfulPlatforms),
    failedPlatforms: normalizePublishTargets(item.failedPlatforms),
    retryablePlatforms: normalizePublishTargets(item.retryablePlatforms),
    nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
    reuseNotes: typeof item.reuseNotes === "string" ? item.reuseNotes : "",
    lastReviewedAt:
      typeof item.lastReviewedAt === "number" && Number.isFinite(item.lastReviewedAt)
        ? item.lastReviewedAt
        : undefined,
    status:
      typeof item.status === "string" && STATUSES.has(item.status as CreatorAssetStatus)
        ? (item.status as CreatorAssetStatus)
        : "radar",
    createdAt,
    updatedAt,
  };
}

function normalizeCreatorAssetTombstone(input: unknown): CreatorAssetStoreTombstone | null {
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

function isCreatorAssetTombstone(
  entry: CreatorAssetStoreEntry,
): entry is CreatorAssetStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): CreatorAssetStoreEntry | null {
  return normalizeCreatorAssetTombstone(input) ?? normalizeCreatorAsset(input);
}

function compareCreatorAssetPriority(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): CreatorAssetStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, CreatorAssetStoreEntry>();
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
      !isCreatorAssetTombstone(existing) &&
      isCreatorAssetTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveByWorkflowRun = new Map<string, CreatorAssetRecord>();
  for (const entry of byId.values()) {
    if (isCreatorAssetTombstone(entry)) continue;
    const existing = liveByWorkflowRun.get(entry.workflowRunId);
    if (!existing || compareCreatorAssetPriority(existing, entry) < 0) {
      liveByWorkflowRun.set(entry.workflowRunId, entry);
    }
  }

  const next: CreatorAssetStoreEntry[] = [];
  const tombstones = new Map<string, CreatorAssetStoreTombstone>();

  for (const entry of byId.values()) {
    if (isCreatorAssetTombstone(entry)) {
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
    const tombstone: CreatorAssetStoreTombstone = {
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

function liveCreatorAssets(entries: CreatorAssetStoreEntry[]) {
  return entries.filter((entry): entry is CreatorAssetRecord => !isCreatorAssetTombstone(entry));
}

function creatorAssetTombstones(entries: CreatorAssetStoreEntry[]) {
  return entries.filter(isCreatorAssetTombstone);
}

export async function listCreatorAssetStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    creatorAssets: liveCreatorAssets(entries),
    tombstones: creatorAssetTombstones(entries),
  };
}

export async function writeCreatorAssetsToStore(input: unknown) {
  const normalized = liveCreatorAssets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertCreatorAssetInStore(input: unknown) {
  const candidate = normalizeCreatorAsset(input);
  if (!candidate) {
    return { creatorAsset: null, tombstone: null, accepted: false };
  }

  let storedCreatorAsset: CreatorAssetRecord | null = candidate;
  let storedTombstone: CreatorAssetStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existingById = entries.find((entry) => entry.id === candidate.id) ?? null;
    const existingByWorkflow = entries.find(
      (entry): entry is CreatorAssetRecord =>
        !isCreatorAssetTombstone(entry) && entry.workflowRunId === candidate.workflowRunId,
    ) ?? null;

    if (
      existingById &&
      (existingById.updatedAt > candidate.updatedAt ||
        (existingById.updatedAt === candidate.updatedAt &&
          isCreatorAssetTombstone(existingById)))
    ) {
      accepted = false;
      if (isCreatorAssetTombstone(existingById)) {
        storedCreatorAsset = null;
        storedTombstone = existingById;
      } else {
        storedCreatorAsset = existingById;
      }
      return entries;
    }

    if (
      existingByWorkflow &&
      existingByWorkflow.id !== candidate.id &&
      compareCreatorAssetPriority(candidate, existingByWorkflow) <= 0
    ) {
      accepted = false;
      storedCreatorAsset = existingByWorkflow;
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
          } satisfies CreatorAssetStoreTombstone);

    const next = [
      candidate,
      ...(replacementTombstone ? [replacementTombstone] : []),
      ...entries.filter(
        (entry) => entry.id !== candidate.id && entry.id !== replacedEntry?.id,
      ),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);

    storedCreatorAsset =
      next.find(
        (entry): entry is CreatorAssetRecord =>
          entry.id === candidate.id && !isCreatorAssetTombstone(entry),
      ) ?? candidate;
    storedTombstone = replacementTombstone;
    return next;
  });

  return { creatorAsset: storedCreatorAsset, tombstone: storedTombstone, accepted };
}

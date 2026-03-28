import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { PublishPlatformId } from "@/lib/publish";

export type CreatorAssetStatus =
  | "radar"
  | "repurposing"
  | "preflight"
  | "publishing"
  | "completed";

export type CreatorAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  radarItemId?: string;
  repurposerProjectId?: string;
  draftId?: string;
  topic: string;
  audience: string;
  sourceChannels: string;
  primaryAngle: string;
  latestDigest: string;
  latestPack: string;
  latestDraftTitle: string;
  latestDraftBody: string;
  publishTargets: PublishPlatformId[];
  publishStatus: string;
  latestPublishFeedback: string;
  successfulPlatforms: PublishPlatformId[];
  failedPlatforms: PublishPlatformId[];
  retryablePlatforms: PublishPlatformId[];
  nextAction: string;
  reuseNotes: string;
  lastReviewedAt?: number;
  status: CreatorAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type CreatorAssetTombstone = SyncTombstoneRecord & {
  workflowRunId?: string;
};

const CREATOR_ASSETS_KEY = "openclaw.creator-assets.v1";
const MAX_CREATOR_ASSETS = 120;

function compareCreatorAssetPriority(left: CreatorAssetRecord, right: CreatorAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function dedupeCreatorAssets(items: CreatorAssetRecord[]) {
  const byId = new Map<string, CreatorAssetRecord>();
  for (const asset of items) {
    const existing = byId.get(asset.id);
    if (!existing || compareCreatorAssetPriority(existing, asset) < 0) {
      byId.set(asset.id, asset);
    }
  }

  const byWorkflowRunId = new Map<string, CreatorAssetRecord>();
  for (const asset of byId.values()) {
    const existing = byWorkflowRunId.get(asset.workflowRunId);
    if (!existing || compareCreatorAssetPriority(existing, asset) < 0) {
      byWorkflowRunId.set(asset.workflowRunId, asset);
    }
  }

  return Array.from(byWorkflowRunId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_CREATOR_ASSETS);
}

const creatorAssetState = createServerBackedListState<
  CreatorAssetRecord,
  CreatorAssetTombstone
>({
  statusId: "creator-assets",
  statusLabel: "创作资产",
  storageKey: CREATOR_ASSETS_KEY,
  eventName: "openclaw:creator-assets",
  maxItems: MAX_CREATOR_ASSETS,
  listPath: "/api/runtime/state/creator-assets",
  itemBodyKey: "creatorAsset",
  sortItems: dedupeCreatorAssets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            creatorAssets?: CreatorAssetRecord[];
            tombstones?: CreatorAssetTombstone[];
          };
        };
    return {
      items: Array.isArray(payload?.data?.creatorAssets) ? payload.data.creatorAssets : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            creatorAsset?: CreatorAssetRecord | null;
            tombstone?: CreatorAssetTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.creatorAsset ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) => dedupeCreatorAssets([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return dedupeCreatorAssets(items.filter((item) => !tombstoneIds.has(item.id)));
  },
  shouldResyncLocalItem: (item, context) => {
    const tombstone = context.tombstoneById.get(item.id);
    if (tombstone && tombstone.deletedAt >= item.updatedAt) {
      return false;
    }

    const serverAsset = context.serverById.get(item.id);
    const serverWorkflowAsset = context.serverItems.find(
      (candidate) => candidate.workflowRunId === item.workflowRunId,
    );
    if (
      serverWorkflowAsset &&
      serverWorkflowAsset.id !== item.id &&
      compareCreatorAssetPriority(item, serverWorkflowAsset) <= 0
    ) {
      return false;
    }
    if (!serverWorkflowAsset || compareCreatorAssetPriority(serverWorkflowAsset, item) < 0) {
      return true;
    }
    return Boolean(serverAsset && item.updatedAt > serverAsset.updatedAt);
  },
});

export async function hydrateCreatorAssetsFromServer(force = false) {
  return creatorAssetState.hydrateFromServer(force);
}

export function subscribeCreatorAssets(listener: Listener) {
  return creatorAssetState.subscribe(listener);
}

export function getCreatorAssets() {
  return creatorAssetState.getItems();
}

export function getCreatorAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getCreatorAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertCreatorAsset(
  workflowRunId: string,
  patch: Partial<Omit<CreatorAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = creatorAssetState.load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: CreatorAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "creator-studio",
        radarItemId: patch.radarItemId,
        repurposerProjectId: patch.repurposerProjectId,
        draftId: patch.draftId,
        topic: patch.topic ?? "",
        audience: patch.audience ?? "",
        sourceChannels: patch.sourceChannels ?? "",
        primaryAngle: patch.primaryAngle ?? "",
        latestDigest: patch.latestDigest ?? "",
        latestPack: patch.latestPack ?? "",
        latestDraftTitle: patch.latestDraftTitle ?? "",
        latestDraftBody: patch.latestDraftBody ?? "",
        publishTargets: patch.publishTargets ?? [],
        publishStatus: patch.publishStatus ?? "not_started",
        latestPublishFeedback: patch.latestPublishFeedback ?? "",
        successfulPlatforms: patch.successfulPlatforms ?? [],
        failedPlatforms: patch.failedPlatforms ?? [],
        retryablePlatforms: patch.retryablePlatforms ?? [],
        nextAction: patch.nextAction ?? "",
        reuseNotes: patch.reuseNotes ?? "",
        lastReviewedAt: patch.lastReviewedAt,
        status: patch.status ?? "radar",
        createdAt: now,
        updatedAt: now,
      };

  creatorAssetState.saveLocal(
    existing
      ? current.map((asset) =>
          asset.workflowRunId === workflowRunId ? nextRecord : asset,
        )
      : [nextRecord, ...current],
  );
  creatorAssetState.emit();
  void creatorAssetState.syncItemToServer(nextRecord);
  return nextRecord;
}

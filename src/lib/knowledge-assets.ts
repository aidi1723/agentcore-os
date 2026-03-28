import type { AssetJumpTarget } from "@/lib/asset-jumps";
import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";

export type KnowledgeAssetType = "sales_playbook" | "support_faq";
export type KnowledgeAssetStatus = "active" | "archived";

export type KnowledgeAssetRecord = {
  id: string;
  sourceKey: string;
  title: string;
  body: string;
  sourceApp: "personal_crm" | "support_copilot";
  scenarioId: string;
  workflowRunId?: string;
  assetType: KnowledgeAssetType;
  status: KnowledgeAssetStatus;
  tags: string[];
  applicableScene: string;
  reuseCount: number;
  sourceJumpTarget?: AssetJumpTarget;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type KnowledgeAssetTombstone = SyncTombstoneRecord & {
  sourceKey?: string;
};

const KNOWLEDGE_ASSETS_KEY = "openclaw.knowledge-assets.v1";
const MAX_KNOWLEDGE_ASSETS = 160;

function compareKnowledgeAssetPriority(
  left: KnowledgeAssetRecord,
  right: KnowledgeAssetRecord,
) {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt - right.updatedAt;
  }
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.id.localeCompare(right.id, "en");
}

function dedupeKnowledgeAssets(items: KnowledgeAssetRecord[]) {
  const byId = new Map<string, KnowledgeAssetRecord>();
  for (const asset of items) {
    const existing = byId.get(asset.id);
    if (!existing || compareKnowledgeAssetPriority(existing, asset) < 0) {
      byId.set(asset.id, asset);
    }
  }

  const bySourceKey = new Map<string, KnowledgeAssetRecord>();
  for (const asset of byId.values()) {
    const existing = bySourceKey.get(asset.sourceKey);
    if (!existing || compareKnowledgeAssetPriority(existing, asset) < 0) {
      bySourceKey.set(asset.sourceKey, asset);
    }
  }

  return Array.from(bySourceKey.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_KNOWLEDGE_ASSETS);
}

const knowledgeAssetState = createServerBackedListState<
  KnowledgeAssetRecord,
  KnowledgeAssetTombstone
>({
  statusId: "knowledge-assets",
  statusLabel: "知识资产",
  storageKey: KNOWLEDGE_ASSETS_KEY,
  eventName: "openclaw:knowledge-assets",
  maxItems: MAX_KNOWLEDGE_ASSETS,
  listPath: "/api/runtime/state/knowledge-assets",
  deletePath: (assetId) =>
    `/api/runtime/state/knowledge-assets/${encodeURIComponent(assetId)}`,
  itemBodyKey: "knowledgeAsset",
  sortItems: dedupeKnowledgeAssets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            knowledgeAssets?: KnowledgeAssetRecord[];
            tombstones?: KnowledgeAssetTombstone[];
          };
        };
    return {
      items: Array.isArray(payload?.data?.knowledgeAssets)
        ? payload.data.knowledgeAssets
        : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            knowledgeAsset?: KnowledgeAssetRecord | null;
            tombstone?: KnowledgeAssetTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.knowledgeAsset ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) =>
    dedupeKnowledgeAssets([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return dedupeKnowledgeAssets(items.filter((item) => !tombstoneIds.has(item.id)));
  },
  shouldResyncLocalItem: (item, context) => {
    const tombstone = context.tombstoneById.get(item.id);
    if (tombstone && tombstone.deletedAt >= item.updatedAt) {
      return false;
    }

    const serverAsset = context.serverById.get(item.id);
    const serverSourceAsset = context.serverItems.find(
      (candidate) => candidate.sourceKey === item.sourceKey,
    );
    if (
      serverSourceAsset &&
      serverSourceAsset.id !== item.id &&
      compareKnowledgeAssetPriority(item, serverSourceAsset) <= 0
    ) {
      return false;
    }
    if (!serverSourceAsset || compareKnowledgeAssetPriority(serverSourceAsset, item) < 0) {
      return true;
    }
    return Boolean(serverAsset && item.updatedAt > serverAsset.updatedAt);
  },
});

export async function hydrateKnowledgeAssetsFromServer(force = false) {
  return knowledgeAssetState.hydrateFromServer(force);
}

export function subscribeKnowledgeAssets(listener: Listener) {
  return knowledgeAssetState.subscribe(listener);
}

export function getKnowledgeAssets() {
  return knowledgeAssetState.getItems();
}

export function upsertKnowledgeAsset(
  sourceKey: string,
  patch: Omit<
    KnowledgeAssetRecord,
    "id" | "sourceKey" | "createdAt" | "updatedAt" | "reuseCount"
  > & {
    reuseCount?: number;
  },
) {
  const now = Date.now();
  const current = knowledgeAssetState.load();
  const existing = current.find((item) => item.sourceKey === sourceKey);
  const nextRecord: KnowledgeAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        sourceKey,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        sourceKey,
        title: patch.title,
        body: patch.body,
        sourceApp: patch.sourceApp,
        scenarioId: patch.scenarioId,
        workflowRunId: patch.workflowRunId,
        assetType: patch.assetType,
        status: patch.status,
        tags: patch.tags,
        applicableScene: patch.applicableScene,
        reuseCount: patch.reuseCount ?? 0,
        sourceJumpTarget: patch.sourceJumpTarget,
        createdAt: now,
        updatedAt: now,
      };

  knowledgeAssetState.saveLocal(
    existing
      ? current.map((item) => (item.sourceKey === sourceKey ? nextRecord : item))
      : [nextRecord, ...current],
  );
  knowledgeAssetState.emit();
  void knowledgeAssetState.syncItemToServer(nextRecord);
  return nextRecord;
}

export function incrementKnowledgeAssetReuse(assetId: string) {
  const now = Date.now();
  let nextAsset: KnowledgeAssetRecord | null = null;
  knowledgeAssetState.saveLocal(
    knowledgeAssetState.load().map((item) => {
      if (item.id !== assetId) return item;
      nextAsset = {
        ...item,
        reuseCount: item.reuseCount + 1,
        updatedAt: now,
      };
      return nextAsset;
    }),
  );
  knowledgeAssetState.emit();
  if (nextAsset) {
    void knowledgeAssetState.syncItemToServer(nextAsset);
  }
}

export function updateKnowledgeAsset(
  assetId: string,
  patch: Partial<Pick<KnowledgeAssetRecord, "title" | "body" | "tags" | "applicableScene">>,
) {
  const now = Date.now();
  let nextAsset: KnowledgeAssetRecord | null = null;
  knowledgeAssetState.saveLocal(
    knowledgeAssetState.load().map((item) => {
      if (item.id !== assetId) return item;
      nextAsset = {
        ...item,
        ...patch,
        updatedAt: now,
      };
      return nextAsset;
    }),
  );
  knowledgeAssetState.emit();
  if (nextAsset) {
    void knowledgeAssetState.syncItemToServer(nextAsset);
  }
}

export function removeKnowledgeAsset(assetId: string) {
  const current =
    knowledgeAssetState.load().find((item) => item.id === assetId) ?? null;
  knowledgeAssetState.saveLocal(
    knowledgeAssetState.load().filter((item) => item.id !== assetId),
  );
  knowledgeAssetState.emit();
  if (current) {
    void knowledgeAssetState.removeItemOnServer(assetId, current.updatedAt);
  }
}

export function setKnowledgeAssetStatus(
  assetId: string,
  status: KnowledgeAssetStatus,
) {
  const now = Date.now();
  let nextAsset: KnowledgeAssetRecord | null = null;
  knowledgeAssetState.saveLocal(
    knowledgeAssetState.load().map((item) => {
      if (item.id !== assetId) return item;
      nextAsset = { ...item, status, updatedAt: now };
      return nextAsset;
    }),
  );
  knowledgeAssetState.emit();
  if (nextAsset) {
    void knowledgeAssetState.syncItemToServer(nextAsset);
  }
}

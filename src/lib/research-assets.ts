import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";

export type ResearchAssetStatus =
  | "capture"
  | "synthesizing"
  | "routing"
  | "completed";

export type ResearchAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  reportId?: string;
  briefId?: string;
  topic: string;
  audience: string;
  angle: string;
  sources: string;
  latestReport: string;
  latestBrief: string;
  vaultQuery: string;
  nextAction: string;
  status: ResearchAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type ResearchAssetTombstone = SyncTombstoneRecord & {
  workflowRunId?: string;
};

const RESEARCH_ASSETS_KEY = "openclaw.research-assets.v1";
const MAX_RESEARCH_ASSETS = 120;

function compareResearchAssetPriority(left: ResearchAssetRecord, right: ResearchAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function dedupeResearchAssets(items: ResearchAssetRecord[]) {
  const byId = new Map<string, ResearchAssetRecord>();
  for (const asset of items) {
    const existing = byId.get(asset.id);
    if (!existing || compareResearchAssetPriority(existing, asset) < 0) {
      byId.set(asset.id, asset);
    }
  }

  const byWorkflowRunId = new Map<string, ResearchAssetRecord>();
  for (const asset of byId.values()) {
    const existing = byWorkflowRunId.get(asset.workflowRunId);
    if (!existing || compareResearchAssetPriority(existing, asset) < 0) {
      byWorkflowRunId.set(asset.workflowRunId, asset);
    }
  }

  return Array.from(byWorkflowRunId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RESEARCH_ASSETS);
}

const researchAssetState = createServerBackedListState<
  ResearchAssetRecord,
  ResearchAssetTombstone
>({
  statusId: "research-assets",
  statusLabel: "研究资产",
  storageKey: RESEARCH_ASSETS_KEY,
  eventName: "openclaw:research-assets",
  maxItems: MAX_RESEARCH_ASSETS,
  listPath: "/api/runtime/state/research-assets",
  itemBodyKey: "researchAsset",
  sortItems: dedupeResearchAssets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            researchAssets?: ResearchAssetRecord[];
            tombstones?: ResearchAssetTombstone[];
          };
        };
    return {
      items: Array.isArray(payload?.data?.researchAssets) ? payload.data.researchAssets : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            researchAsset?: ResearchAssetRecord | null;
            tombstone?: ResearchAssetTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.researchAsset ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) => dedupeResearchAssets([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return dedupeResearchAssets(items.filter((item) => !tombstoneIds.has(item.id)));
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
      compareResearchAssetPriority(item, serverWorkflowAsset) <= 0
    ) {
      return false;
    }
    if (!serverWorkflowAsset || compareResearchAssetPriority(serverWorkflowAsset, item) < 0) {
      return true;
    }
    return Boolean(serverAsset && item.updatedAt > serverAsset.updatedAt);
  },
});

export async function hydrateResearchAssetsFromServer(force = false) {
  return researchAssetState.hydrateFromServer(force);
}

export function subscribeResearchAssets(listener: Listener) {
  return researchAssetState.subscribe(listener);
}

export function getResearchAssets() {
  return researchAssetState.getItems();
}

export function getResearchAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getResearchAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertResearchAsset(
  workflowRunId: string,
  patch: Partial<Omit<ResearchAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = researchAssetState.load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: ResearchAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "research-radar",
        reportId: patch.reportId,
        briefId: patch.briefId,
        topic: patch.topic ?? "",
        audience: patch.audience ?? "",
        angle: patch.angle ?? "",
        sources: patch.sources ?? "",
        latestReport: patch.latestReport ?? "",
        latestBrief: patch.latestBrief ?? "",
        vaultQuery: patch.vaultQuery ?? "",
        nextAction: patch.nextAction ?? "",
        status: patch.status ?? "capture",
        createdAt: now,
        updatedAt: now,
      };

  researchAssetState.saveLocal(
    existing
      ? current.map((asset) =>
          asset.workflowRunId === workflowRunId ? nextRecord : asset,
        )
      : [nextRecord, ...current],
  );
  researchAssetState.emit();
  void researchAssetState.syncItemToServer(nextRecord);
  return nextRecord;
}

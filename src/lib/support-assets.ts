import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";

export type SupportAssetStatus =
  | "capture"
  | "replying"
  | "followup"
  | "faq"
  | "completed";

export type SupportAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  inboxItemId?: string;
  ticketId?: string;
  customer: string;
  channel: string;
  issueSummary: string;
  latestDigest: string;
  latestReply: string;
  escalationTask: string;
  faqDraft: string;
  nextAction: string;
  status: SupportAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type SupportAssetTombstone = SyncTombstoneRecord & {
  workflowRunId?: string;
};

const SUPPORT_ASSETS_KEY = "openclaw.support-assets.v1";
const MAX_SUPPORT_ASSETS = 120;

function compareSupportAssetPriority(left: SupportAssetRecord, right: SupportAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function dedupeSupportAssets(items: SupportAssetRecord[]) {
  const byId = new Map<string, SupportAssetRecord>();
  for (const asset of items) {
    const existing = byId.get(asset.id);
    if (!existing || compareSupportAssetPriority(existing, asset) < 0) {
      byId.set(asset.id, asset);
    }
  }

  const byWorkflowRunId = new Map<string, SupportAssetRecord>();
  for (const asset of byId.values()) {
    const existing = byWorkflowRunId.get(asset.workflowRunId);
    if (!existing || compareSupportAssetPriority(existing, asset) < 0) {
      byWorkflowRunId.set(asset.workflowRunId, asset);
    }
  }

  return Array.from(byWorkflowRunId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SUPPORT_ASSETS);
}

const supportAssetState = createServerBackedListState<
  SupportAssetRecord,
  SupportAssetTombstone
>({
  statusId: "support-assets",
  statusLabel: "客服资产",
  storageKey: SUPPORT_ASSETS_KEY,
  eventName: "openclaw:support-assets",
  maxItems: MAX_SUPPORT_ASSETS,
  listPath: "/api/runtime/state/support-assets",
  itemBodyKey: "supportAsset",
  sortItems: dedupeSupportAssets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { supportAssets?: SupportAssetRecord[]; tombstones?: SupportAssetTombstone[] };
        };
    return {
      items: Array.isArray(payload?.data?.supportAssets) ? payload.data.supportAssets : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            supportAsset?: SupportAssetRecord | null;
            tombstone?: SupportAssetTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.supportAsset ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) => dedupeSupportAssets([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return dedupeSupportAssets(items.filter((item) => !tombstoneIds.has(item.id)));
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
      compareSupportAssetPriority(item, serverWorkflowAsset) <= 0
    ) {
      return false;
    }
    if (!serverWorkflowAsset || compareSupportAssetPriority(serverWorkflowAsset, item) < 0) {
      return true;
    }
    return Boolean(serverAsset && item.updatedAt > serverAsset.updatedAt);
  },
});

export async function hydrateSupportAssetsFromServer(force = false) {
  return supportAssetState.hydrateFromServer(force);
}

export function subscribeSupportAssets(listener: Listener) {
  return supportAssetState.subscribe(listener);
}

export function getSupportAssets() {
  return supportAssetState.getItems();
}

export function getSupportAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getSupportAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertSupportAsset(
  workflowRunId: string,
  patch: Partial<Omit<SupportAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = supportAssetState.load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: SupportAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "support-ops",
        inboxItemId: patch.inboxItemId,
        ticketId: patch.ticketId,
        customer: patch.customer ?? "",
        channel: patch.channel ?? "",
        issueSummary: patch.issueSummary ?? "",
        latestDigest: patch.latestDigest ?? "",
        latestReply: patch.latestReply ?? "",
        escalationTask: patch.escalationTask ?? "",
        faqDraft: patch.faqDraft ?? "",
        nextAction: patch.nextAction ?? "",
        status: patch.status ?? "capture",
        createdAt: now,
        updatedAt: now,
      };

  supportAssetState.saveLocal(
    existing
      ? current.map((asset) =>
          asset.workflowRunId === workflowRunId ? nextRecord : asset,
        )
      : [nextRecord, ...current],
  );
  supportAssetState.emit();
  void supportAssetState.syncItemToServer(nextRecord);
  return nextRecord;
}

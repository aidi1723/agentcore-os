import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";

export type SalesAssetStatus =
  | "qualifying"
  | "awaiting_review"
  | "crm_syncing"
  | "completed";

export type SalesAssetRecord = {
  id: string;
  workflowRunId: string;
  scenarioId: string;
  dealId?: string;
  emailThreadId?: string;
  contactId?: string;
  company: string;
  contactName: string;
  inquiryChannel: string;
  preferredLanguage: string;
  productLine: string;
  requirementSummary: string;
  preferenceNotes: string;
  objectionNotes: string;
  nextAction: string;
  quoteNotes: string;
  quoteStatus: string;
  latestDraftSubject: string;
  latestDraftBody: string;
  assetDraft: string;
  status: SalesAssetStatus;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type SalesAssetTombstone = SyncTombstoneRecord & {
  workflowRunId?: string;
};

const SALES_ASSETS_KEY = "openclaw.sales-assets.v1";
const MAX_SALES_ASSETS = 120;

function compareSalesAssetPriority(left: SalesAssetRecord, right: SalesAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function dedupeSalesAssets(items: SalesAssetRecord[]) {
  const byId = new Map<string, SalesAssetRecord>();
  for (const asset of items) {
    const existing = byId.get(asset.id);
    if (!existing || compareSalesAssetPriority(existing, asset) < 0) {
      byId.set(asset.id, asset);
    }
  }

  const byWorkflowRunId = new Map<string, SalesAssetRecord>();
  for (const asset of byId.values()) {
    const existing = byWorkflowRunId.get(asset.workflowRunId);
    if (!existing || compareSalesAssetPriority(existing, asset) < 0) {
      byWorkflowRunId.set(asset.workflowRunId, asset);
    }
  }

  return Array.from(byWorkflowRunId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_SALES_ASSETS);
}

const salesAssetState = createServerBackedListState<
  SalesAssetRecord,
  SalesAssetTombstone
>({
  statusId: "sales-assets",
  statusLabel: "销售资产",
  storageKey: SALES_ASSETS_KEY,
  eventName: "openclaw:sales-assets",
  maxItems: MAX_SALES_ASSETS,
  listPath: "/api/runtime/state/sales-assets",
  itemBodyKey: "salesAsset",
  sortItems: dedupeSalesAssets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { salesAssets?: SalesAssetRecord[]; tombstones?: SalesAssetTombstone[] };
        };
    return {
      items: Array.isArray(payload?.data?.salesAssets) ? payload.data.salesAssets : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            salesAsset?: SalesAssetRecord | null;
            tombstone?: SalesAssetTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.salesAsset ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) => dedupeSalesAssets([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return dedupeSalesAssets(items.filter((item) => !tombstoneIds.has(item.id)));
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
      compareSalesAssetPriority(item, serverWorkflowAsset) <= 0
    ) {
      return false;
    }
    if (!serverWorkflowAsset || compareSalesAssetPriority(serverWorkflowAsset, item) < 0) {
      return true;
    }
    return Boolean(serverAsset && item.updatedAt > serverAsset.updatedAt);
  },
});

export async function hydrateSalesAssetsFromServer(force = false) {
  return salesAssetState.hydrateFromServer(force);
}

export function subscribeSalesAssets(listener: Listener) {
  return salesAssetState.subscribe(listener);
}

export function getSalesAssets() {
  return salesAssetState.getItems();
}

export function getSalesAssetByWorkflowRunId(workflowRunId?: string | null) {
  if (!workflowRunId) return null;
  return getSalesAssets().find((asset) => asset.workflowRunId === workflowRunId) ?? null;
}

export function upsertSalesAsset(
  workflowRunId: string,
  patch: Partial<Omit<SalesAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const current = salesAssetState.load();
  const existing = current.find((asset) => asset.workflowRunId === workflowRunId);

  const nextRecord: SalesAssetRecord = existing
    ? {
        ...existing,
        ...patch,
        workflowRunId,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        workflowRunId,
        scenarioId: patch.scenarioId ?? "sales-pipeline",
        dealId: patch.dealId,
        emailThreadId: patch.emailThreadId,
        contactId: patch.contactId,
        company: patch.company ?? "",
        contactName: patch.contactName ?? "",
        inquiryChannel: patch.inquiryChannel ?? "",
        preferredLanguage: patch.preferredLanguage ?? "",
        productLine: patch.productLine ?? "",
        requirementSummary: patch.requirementSummary ?? "",
        preferenceNotes: patch.preferenceNotes ?? "",
        objectionNotes: patch.objectionNotes ?? "",
        nextAction: patch.nextAction ?? "",
        quoteNotes: patch.quoteNotes ?? "",
        quoteStatus: patch.quoteStatus ?? "not_started",
        latestDraftSubject: patch.latestDraftSubject ?? "",
        latestDraftBody: patch.latestDraftBody ?? "",
        assetDraft: patch.assetDraft ?? "",
        status: patch.status ?? "qualifying",
        createdAt: now,
        updatedAt: now,
      };

  salesAssetState.saveLocal(
    existing
      ? current.map((asset) =>
          asset.workflowRunId === workflowRunId ? nextRecord : asset,
        )
      : [nextRecord, ...current],
  );
  salesAssetState.emit();
  void salesAssetState.syncItemToServer(nextRecord);
  return nextRecord;
}

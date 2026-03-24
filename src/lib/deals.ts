export type DealStage = "new" | "qualified" | "proposal" | "blocked" | "won";

import { createServerBackedListState, type SyncTombstoneRecord } from "@/lib/server-backed-list-state";
import type { SalesWorkflowMeta } from "@/lib/sales-workflow";

export type DealRecord = {
  id: string;
  company: string;
  contact: string;
  inquiryChannel: string;
  preferredLanguage: string;
  productLine: string;
  need: string;
  budget: string;
  timing: string;
  stage: DealStage;
  notes: string;
  brief: string;
  reviewNotes: string;
  createdAt: number;
  updatedAt: number;
} & SalesWorkflowMeta;

type Listener = () => void;
type DealTombstone = SyncTombstoneRecord;

const DEALS_KEY = "openclaw.deals.v1";
const MAX_DEALS = 120;

function sortDeals(items: DealRecord[]) {
  return items.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_DEALS);
}

const dealState = createServerBackedListState<DealRecord, DealTombstone>({
  statusId: "deals",
  statusLabel: "销售线索",
  storageKey: DEALS_KEY,
  eventName: "openclaw:deals",
  maxItems: MAX_DEALS,
  listPath: "/api/runtime/state/deals",
  deletePath: (dealId) => `/api/runtime/state/deals/${encodeURIComponent(dealId)}`,
  itemBodyKey: "deal",
  sortItems: sortDeals,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { deals?: DealRecord[]; tombstones?: DealTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.deals) ? payload.data.deals : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { deal?: DealRecord | null; tombstone?: DealTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.deal ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateDealsFromServer(force = false) {
  return dealState.hydrateFromServer(force);
}

export function getDeals() {
  return dealState.getItems();
}

export function createDeal(input?: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const deal: DealRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    company: input?.company?.trim() || "新线索",
    contact: input?.contact ?? "",
    inquiryChannel: input?.inquiryChannel ?? "",
    preferredLanguage: input?.preferredLanguage ?? "",
    productLine: input?.productLine ?? "",
    need: input?.need ?? "",
    budget: input?.budget ?? "",
    timing: input?.timing ?? "",
    stage: input?.stage ?? "new",
    notes: input?.notes ?? "",
    brief: input?.brief ?? "",
    reviewNotes: input?.reviewNotes ?? "",
    workflowRunId: input?.workflowRunId,
    workflowScenarioId: input?.workflowScenarioId,
    workflowStageId: input?.workflowStageId,
    workflowSource: input?.workflowSource?.trim() || undefined,
    workflowNextStep: input?.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input?.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  dealState.saveLocal([deal, ...dealState.load()]);
  dealState.emit();
  void dealState.syncItemToServer(deal);
  return deal.id;
}

export function updateDeal(
  dealId: string,
  patch: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  let nextDeal: DealRecord | null = null;
  dealState.saveLocal(
    dealState.load().map((deal) => {
      if (deal.id !== dealId) return deal;
      nextDeal = {
        ...deal,
        ...patch,
        updatedAt: now,
      };
      return nextDeal;
    }),
  );
  dealState.emit();
  if (nextDeal) {
    void dealState.syncItemToServer(nextDeal);
  }
}

export function removeDeal(dealId: string) {
  const current = dealState.load().find((deal) => deal.id === dealId) ?? null;
  dealState.saveLocal(dealState.load().filter((deal) => deal.id !== dealId));
  dealState.emit();
  if (current) {
    void dealState.removeItemOnServer(dealId, current.updatedAt);
  }
}

export function subscribeDeals(listener: Listener) {
  return dealState.subscribe(listener);
}

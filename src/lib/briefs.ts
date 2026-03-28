import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { ResearchWorkflowMeta } from "@/lib/research-workflow";

export type BriefRecord = {
  id: string;
  focus: string;
  notes: string;
  content: string;
  createdAt: number;
  updatedAt: number;
} & ResearchWorkflowMeta;

type Listener = () => void;
type BriefTombstone = SyncTombstoneRecord;

const BRIEFS_KEY = "openclaw.briefs.v1";
const MAX_BRIEFS = 24;

function sortBriefs(items: BriefRecord[]) {
  return items
    .slice()
    .sort((left, right) => {
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, MAX_BRIEFS);
}

const briefState = createServerBackedListState<BriefRecord, BriefTombstone>({
  statusId: "briefs",
  statusLabel: "晨报",
  storageKey: BRIEFS_KEY,
  eventName: "openclaw:briefs",
  maxItems: MAX_BRIEFS,
  listPath: "/api/runtime/state/briefs",
  itemBodyKey: "brief",
  sortItems: sortBriefs,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { briefs?: BriefRecord[]; tombstones?: BriefTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.briefs) ? payload.data.briefs : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { brief?: BriefRecord | null; tombstone?: BriefTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.brief ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateBriefsFromServer(force = false) {
  return briefState.hydrateFromServer(force);
}

export function getBriefs() {
  return briefState.getItems();
}

export function createBrief(input: Omit<BriefRecord, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const brief: BriefRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  briefState.saveLocal([brief, ...briefState.load()]);
  briefState.emit();
  void briefState.syncItemToServer(brief);
  return brief.id;
}

export function subscribeBriefs(listener: Listener) {
  return briefState.subscribe(listener);
}

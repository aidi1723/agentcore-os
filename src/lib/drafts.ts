import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { CreatorWorkflowMeta } from "@/lib/creator-workflow";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";

export type DraftId = string;

export type DraftSource = "media_ops" | "publisher" | "import";

export type DraftRecord = {
  id: DraftId;
  title: string;
  body: string;
  tags?: string[];
  source: DraftSource;
  workflowSource?: string;
  workflowNextStep?: string;
  createdAt: number;
  updatedAt: number;
} & CreatorWorkflowMeta;

type Listener = () => void;
type DraftTombstone = SyncTombstoneRecord;

const DRAFTS_KEY = "openclaw.drafts.v1";
const MAX_DRAFTS = 200;

function sortDrafts(items: DraftRecord[]) {
  return items
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_DRAFTS);
}

const draftState = createServerBackedListState<DraftRecord, DraftTombstone>({
  statusId: "drafts",
  statusLabel: "草稿",
  storageKey: DRAFTS_KEY,
  eventName: "openclaw:drafts",
  maxItems: MAX_DRAFTS,
  listPath: "/api/runtime/state/drafts",
  deletePath: (draftId) => `/api/runtime/state/drafts/${encodeURIComponent(draftId)}`,
  itemBodyKey: "draft",
  sortItems: sortDrafts,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { drafts?: DraftRecord[]; tombstones?: DraftTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.drafts) ? payload.data.drafts : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { draft?: DraftRecord | null; tombstone?: DraftTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.draft ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateDraftsFromServer(force = false) {
  return draftState.hydrateFromServer(force);
}

export function subscribeDrafts(listener: Listener) {
  return draftState.subscribe(listener);
}

export function getDrafts() {
  return draftState.getItems();
}

export function createDraft(input: {
  title: string;
  body: string;
  tags?: string[];
  source?: DraftSource;
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: WorkflowTriggerType;
  workflowOriginApp?: CreatorWorkflowMeta["workflowOriginApp"];
  workflowOriginId?: string;
  workflowOriginLabel?: string;
  workflowAudience?: string;
  workflowPrimaryAngle?: string;
  workflowSourceSummary?: string;
  workflowBlockLabel?: string;
  workflowSuggestedPlatforms?: CreatorWorkflowMeta["workflowSuggestedPlatforms"];
  workflowPublishNotes?: string;
}) {
  const now = Date.now();
  const draft: DraftRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input.title.trim() || "未命名草稿",
    body: input.body,
    tags: input.tags,
    source: input.source ?? "publisher",
    workflowRunId: input.workflowRunId,
    workflowScenarioId: input.workflowScenarioId,
    workflowStageId: input.workflowStageId,
    workflowSource: input.workflowSource?.trim() || undefined,
    workflowNextStep: input.workflowNextStep?.trim() || undefined,
    workflowTriggerType: input.workflowTriggerType,
    workflowOriginApp: input.workflowOriginApp,
    workflowOriginId: input.workflowOriginId?.trim() || undefined,
    workflowOriginLabel: input.workflowOriginLabel?.trim() || undefined,
    workflowAudience: input.workflowAudience?.trim() || undefined,
    workflowPrimaryAngle: input.workflowPrimaryAngle?.trim() || undefined,
    workflowSourceSummary: input.workflowSourceSummary?.trim() || undefined,
    workflowBlockLabel: input.workflowBlockLabel?.trim() || undefined,
    workflowSuggestedPlatforms: input.workflowSuggestedPlatforms?.slice(0, 8),
    workflowPublishNotes: input.workflowPublishNotes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  draftState.saveLocal([draft, ...draftState.load()]);
  draftState.emit();
  void draftState.syncItemToServer(draft);
  return draft.id;
}

export function updateDraft(
  draftId: DraftId,
  patch: Partial<
    Pick<
      DraftRecord,
      | "title"
      | "body"
      | "tags"
      | "workflowRunId"
      | "workflowScenarioId"
      | "workflowStageId"
      | "workflowSource"
      | "workflowNextStep"
      | "workflowTriggerType"
      | "workflowOriginApp"
      | "workflowOriginId"
      | "workflowOriginLabel"
      | "workflowAudience"
      | "workflowPrimaryAngle"
      | "workflowSourceSummary"
      | "workflowBlockLabel"
      | "workflowSuggestedPlatforms"
      | "workflowPublishNotes"
    >
  >,
) {
  const now = Date.now();
  let nextDraft: DraftRecord | null = null;
  draftState.saveLocal(
    draftState.load().map((draft) => {
      if (draft.id !== draftId) return draft;
      nextDraft = {
        ...draft,
        ...patch,
        updatedAt: now,
      };
      return nextDraft;
    }),
  );
  draftState.emit();
  if (nextDraft) {
    void draftState.syncItemToServer(nextDraft);
  }
}

export function removeDraft(draftId: DraftId) {
  const current = draftState.load().find((draft) => draft.id === draftId) ?? null;
  draftState.saveLocal(draftState.load().filter((draft) => draft.id !== draftId));
  draftState.emit();
  if (current) {
    void draftState.removeItemOnServer(draftId, current.updatedAt);
  }
}

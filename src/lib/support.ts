import { createServerBackedListState, type SyncTombstoneRecord } from "@/lib/server-backed-list-state";
import type { SupportWorkflowMeta } from "@/lib/support-workflow";

export type SupportChannel = "email" | "whatsapp" | "instagram" | "reviews";
export type SupportStatus = "new" | "waiting" | "resolved";

export type SupportTicket = {
  id: string;
  customer: string;
  channel: SupportChannel;
  subject: string;
  message: string;
  status: SupportStatus;
  replyDraft: string;
  reviewNotes: string;
  createdAt: number;
  updatedAt: number;
} & SupportWorkflowMeta;

type Listener = () => void;
type SupportTicketTombstone = SyncTombstoneRecord;

const SUPPORT_KEY = "openclaw.support.v1";
const MAX_SUPPORT_TICKETS = 160;

function sortSupportTickets(items: SupportTicket[]) {
  return items
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SUPPORT_TICKETS);
}

const supportState = createServerBackedListState<
  SupportTicket,
  SupportTicketTombstone
>({
  statusId: "support",
  statusLabel: "客服工单",
  storageKey: SUPPORT_KEY,
  eventName: "openclaw:support",
  maxItems: MAX_SUPPORT_TICKETS,
  listPath: "/api/runtime/state/support",
  deletePath: (ticketId) => `/api/runtime/state/support/${encodeURIComponent(ticketId)}`,
  itemBodyKey: "ticket",
  sortItems: sortSupportTickets,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { tickets?: SupportTicket[]; tombstones?: SupportTicketTombstone[] };
        };
    return {
      items: Array.isArray(payload?.data?.tickets) ? payload.data.tickets : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            ticket?: SupportTicket | null;
            tombstone?: SupportTicketTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.ticket ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateSupportTicketsFromServer(force = false) {
  return supportState.hydrateFromServer(force);
}

export function getSupportTickets() {
  return supportState.getItems();
}

export function createSupportTicket(
  input?: Partial<Omit<SupportTicket, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const ticket: SupportTicket = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    customer: input?.customer?.trim() || "新客户",
    channel: input?.channel ?? "email",
    subject: input?.subject?.trim() || "未命名工单",
    message: input?.message ?? "",
    status: input?.status ?? "new",
    replyDraft: input?.replyDraft ?? "",
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
  supportState.saveLocal([ticket, ...supportState.load()]);
  supportState.emit();
  void supportState.syncItemToServer(ticket);
  return ticket.id;
}

export function updateSupportTicket(
  ticketId: string,
  patch: Partial<Omit<SupportTicket, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  let nextTicket: SupportTicket | null = null;
  supportState.saveLocal(
    supportState.load().map((ticket) => {
      if (ticket.id !== ticketId) return ticket;
      nextTicket = {
        ...ticket,
        ...patch,
        updatedAt: now,
      };
      return nextTicket;
    }),
  );
  supportState.emit();
  if (nextTicket) {
    void supportState.syncItemToServer(nextTicket);
  }
}

export function removeSupportTicket(ticketId: string) {
  const current = supportState.load().find((ticket) => ticket.id === ticketId) ?? null;
  supportState.saveLocal(supportState.load().filter((ticket) => ticket.id !== ticketId));
  supportState.emit();
  if (current) {
    void supportState.removeItemOnServer(ticketId, current.updatedAt);
  }
}

export function subscribeSupportTickets(listener: Listener) {
  return supportState.subscribe(listener);
}

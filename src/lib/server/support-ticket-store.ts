import type { SupportChannel, SupportStatus, SupportTicket } from "@/lib/support";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "support-tickets.json";
const MAX_ITEMS = 320;
const CHANNELS = new Set<SupportChannel>(["email", "whatsapp", "instagram", "reviews"]);
const STATUSES = new Set<SupportStatus>(["new", "waiting", "resolved"]);

export type SupportTicketStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type SupportTicketStoreEntry = SupportTicket | SupportTicketStoreTombstone;

function normalizeTicket(input: unknown): SupportTicket | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;
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
    customer: typeof item.customer === "string" ? item.customer : "新客户",
    channel:
      typeof item.channel === "string" && CHANNELS.has(item.channel as SupportChannel)
        ? (item.channel as SupportChannel)
        : "email",
    subject: typeof item.subject === "string" ? item.subject : "未命名工单",
    message: typeof item.message === "string" ? item.message : "",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as SupportStatus)
        ? (item.status as SupportStatus)
        : "new",
    replyDraft: typeof item.replyDraft === "string" ? item.replyDraft : "",
    reviewNotes: typeof item.reviewNotes === "string" ? item.reviewNotes : "",
    workflowRunId: typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    workflowScenarioId:
      typeof item.workflowScenarioId === "string" ? item.workflowScenarioId : undefined,
    workflowStageId: typeof item.workflowStageId === "string" ? item.workflowStageId : undefined,
    workflowSource: typeof item.workflowSource === "string" ? item.workflowSource : undefined,
    workflowNextStep:
      typeof item.workflowNextStep === "string" ? item.workflowNextStep : undefined,
    workflowTriggerType:
      item.workflowTriggerType === "manual" ||
      item.workflowTriggerType === "schedule" ||
      item.workflowTriggerType === "inbound_message" ||
      item.workflowTriggerType === "web_form"
        ? item.workflowTriggerType
        : undefined,
    createdAt,
    updatedAt,
  };
}

function normalizeSupportTicketTombstone(
  input: unknown,
): SupportTicketStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return {
    id,
    updatedAt,
    deletedAt,
  };
}

function isSupportTicketTombstone(
  entry: SupportTicketStoreEntry,
): entry is SupportTicketStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): SupportTicketStoreEntry | null {
  return normalizeSupportTicketTombstone(input) ?? normalizeTicket(input);
}

function normalizeEntries(raw: unknown): SupportTicketStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, SupportTicketStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isSupportTicketTombstone(existing) &&
      isSupportTicketTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveSupportTickets(entries: SupportTicketStoreEntry[]) {
  return entries.filter((entry): entry is SupportTicket => !isSupportTicketTombstone(entry));
}

function supportTicketTombstones(entries: SupportTicketStoreEntry[]) {
  return entries.filter(isSupportTicketTombstone);
}

export async function listSupportTicketsFromStore() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return liveSupportTickets(normalizeEntries(raw));
}

export async function listSupportTicketStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    tickets: liveSupportTickets(entries),
    tombstones: supportTicketTombstones(entries),
  };
}

export async function writeSupportTicketsToStore(input: unknown) {
  const normalized = liveSupportTickets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertSupportTicketInStore(input: unknown) {
  const candidate = normalizeTicket(input);
  if (!candidate) {
    return { ticket: null, accepted: false };
  }

  let storedTicket: SupportTicket | null = candidate;
  let storedTombstone: SupportTicketStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isSupportTicketTombstone(existing)))
    ) {
      accepted = false;
      if (isSupportTicketTombstone(existing)) {
        storedTicket = null;
        storedTombstone = existing;
      } else {
        storedTicket = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedTicket =
      next.find(
        (entry): entry is SupportTicket =>
          entry.id === candidate.id && !isSupportTicketTombstone(entry),
      ) ?? candidate;
    storedTombstone = null;
    return next;
  });

  return { ticket: storedTicket, tombstone: storedTombstone, accepted };
}

export async function removeSupportTicketFromStore(
  ticketId: string,
  updatedAt?: number | null,
) {
  const normalizedId = ticketId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, ticket: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentTicket: SupportTicket | null = null;
  let currentTombstone: SupportTicketStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = {
        id: normalizedId,
        updatedAt: deletedAt,
        deletedAt,
      };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_ITEMS);
    }

    if (isSupportTicketTombstone(existing)) {
      currentTombstone = existing;
      if (
        typeof updatedAt === "number" &&
        Number.isFinite(updatedAt) &&
        existing.updatedAt > updatedAt
      ) {
        conflict = true;
      }
      return entries;
    }

    currentTicket = existing;

    if (
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt) &&
      existing.updatedAt > updatedAt
    ) {
      conflict = true;
      return entries;
    }

    const deletedAt = Date.now();
    currentTombstone = {
      id: normalizedId,
      updatedAt: deletedAt,
      deletedAt,
    };
    removed = true;
    return [currentTombstone, ...entries.filter((entry) => entry.id !== normalizedId)].slice(
      0,
      MAX_ITEMS,
    );
  });

  return {
    removed,
    conflict,
    ticket: currentTicket,
    tombstone: currentTombstone,
  };
}

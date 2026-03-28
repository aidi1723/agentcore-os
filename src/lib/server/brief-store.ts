import type { BriefRecord } from "@/lib/briefs";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";

const FILE_NAME = "briefs.json";
const MAX_ITEMS = 48;
const TRIGGERS = new Set<WorkflowTriggerType>([
  "manual",
  "schedule",
  "inbound_message",
  "web_form",
]);

export type BriefStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type BriefStoreEntry = BriefRecord | BriefStoreTombstone;

function normalizeBrief(input: unknown): BriefRecord | null {
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
    focus: typeof item.focus === "string" ? item.focus : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    content: typeof item.content === "string" ? item.content : "",
    workflowRunId: typeof item.workflowRunId === "string" ? item.workflowRunId : undefined,
    workflowScenarioId:
      typeof item.workflowScenarioId === "string" ? item.workflowScenarioId : undefined,
    workflowStageId: typeof item.workflowStageId === "string" ? item.workflowStageId : undefined,
    workflowSource: typeof item.workflowSource === "string" ? item.workflowSource : undefined,
    workflowNextStep:
      typeof item.workflowNextStep === "string" ? item.workflowNextStep : undefined,
    workflowTriggerType:
      typeof item.workflowTriggerType === "string" &&
      TRIGGERS.has(item.workflowTriggerType as WorkflowTriggerType)
        ? (item.workflowTriggerType as WorkflowTriggerType)
        : undefined,
    createdAt,
    updatedAt,
  };
}

function normalizeBriefTombstone(input: unknown): BriefStoreTombstone | null {
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
  return { id, updatedAt, deletedAt };
}

function isBriefTombstone(entry: BriefStoreEntry): entry is BriefStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): BriefStoreEntry | null {
  return normalizeBriefTombstone(input) ?? normalizeBrief(input);
}

function normalizeEntries(raw: unknown): BriefStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, BriefStoreEntry>();
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
      !isBriefTombstone(existing) &&
      isBriefTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveBriefs(entries: BriefStoreEntry[]) {
  return entries.filter((entry): entry is BriefRecord => !isBriefTombstone(entry));
}

function briefTombstones(entries: BriefStoreEntry[]) {
  return entries.filter(isBriefTombstone);
}

export async function listBriefStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    briefs: liveBriefs(entries),
    tombstones: briefTombstones(entries),
  };
}

export async function writeBriefsToStore(input: unknown) {
  const normalized = liveBriefs(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertBriefInStore(input: unknown) {
  const candidate = normalizeBrief(input);
  if (!candidate) {
    return { brief: null, tombstone: null, accepted: false };
  }

  let storedBrief: BriefRecord | null = candidate;
  let storedTombstone: BriefStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isBriefTombstone(existing)))
    ) {
      accepted = false;
      if (isBriefTombstone(existing)) {
        storedBrief = null;
        storedTombstone = existing;
      } else {
        storedBrief = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedBrief =
      next.find(
        (entry): entry is BriefRecord =>
          entry.id === candidate.id && !isBriefTombstone(entry),
      ) ?? candidate;
    storedTombstone = null;
    return next;
  });

  return { brief: storedBrief, tombstone: storedTombstone, accepted };
}

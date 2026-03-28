import type { ResearchAssetRecord, ResearchAssetStatus } from "@/lib/research-assets";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "research-assets.json";
const MAX_ITEMS = 240;
const STATUSES = new Set<ResearchAssetStatus>([
  "capture",
  "synthesizing",
  "routing",
  "completed",
]);

export type ResearchAssetStoreTombstone = {
  id: string;
  workflowRunId: string;
  updatedAt: number;
  deletedAt: number;
};

type ResearchAssetStoreEntry = ResearchAssetRecord | ResearchAssetStoreTombstone;

function normalizeResearchAsset(input: unknown): ResearchAssetRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const workflowRunId =
    typeof item.workflowRunId === "string" && item.workflowRunId.trim()
      ? item.workflowRunId.trim()
      : null;
  if (!id || !workflowRunId) return null;
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
    workflowRunId,
    scenarioId:
      typeof item.scenarioId === "string" && item.scenarioId.trim()
        ? item.scenarioId
        : "research-radar",
    reportId: typeof item.reportId === "string" ? item.reportId : undefined,
    briefId: typeof item.briefId === "string" ? item.briefId : undefined,
    topic: typeof item.topic === "string" ? item.topic : "",
    audience: typeof item.audience === "string" ? item.audience : "",
    angle: typeof item.angle === "string" ? item.angle : "",
    sources: typeof item.sources === "string" ? item.sources : "",
    latestReport: typeof item.latestReport === "string" ? item.latestReport : "",
    latestBrief: typeof item.latestBrief === "string" ? item.latestBrief : "",
    vaultQuery: typeof item.vaultQuery === "string" ? item.vaultQuery : "",
    nextAction: typeof item.nextAction === "string" ? item.nextAction : "",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as ResearchAssetStatus)
        ? (item.status as ResearchAssetStatus)
        : "capture",
    createdAt,
    updatedAt,
  };
}

function normalizeResearchAssetTombstone(input: unknown): ResearchAssetStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const workflowRunId =
    typeof item.workflowRunId === "string" && item.workflowRunId.trim()
      ? item.workflowRunId.trim()
      : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || !workflowRunId || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return { id, workflowRunId, updatedAt, deletedAt };
}

function isResearchAssetTombstone(
  entry: ResearchAssetStoreEntry,
): entry is ResearchAssetStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): ResearchAssetStoreEntry | null {
  return normalizeResearchAssetTombstone(input) ?? normalizeResearchAsset(input);
}

function compareResearchAssetPriority(left: ResearchAssetRecord, right: ResearchAssetRecord) {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): ResearchAssetStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, ResearchAssetStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = byId.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      byId.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isResearchAssetTombstone(existing) &&
      isResearchAssetTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveByWorkflowRun = new Map<string, ResearchAssetRecord>();
  for (const entry of byId.values()) {
    if (isResearchAssetTombstone(entry)) continue;
    const existing = liveByWorkflowRun.get(entry.workflowRunId);
    if (!existing || compareResearchAssetPriority(existing, entry) < 0) {
      liveByWorkflowRun.set(entry.workflowRunId, entry);
    }
  }

  const next: ResearchAssetStoreEntry[] = [];
  const tombstones = new Map<string, ResearchAssetStoreTombstone>();

  for (const entry of byId.values()) {
    if (isResearchAssetTombstone(entry)) {
      const existing = tombstones.get(entry.id);
      if (!existing || existing.updatedAt <= entry.updatedAt) {
        tombstones.set(entry.id, entry);
      }
      continue;
    }
    const activeWorkflowAsset = liveByWorkflowRun.get(entry.workflowRunId);
    if (activeWorkflowAsset?.id === entry.id) {
      next.push(entry);
      continue;
    }
    const deletedAt = Math.max(entry.updatedAt, activeWorkflowAsset?.updatedAt ?? entry.updatedAt);
    const tombstone: ResearchAssetStoreTombstone = {
      id: entry.id,
      workflowRunId: entry.workflowRunId,
      updatedAt: deletedAt,
      deletedAt,
    };
    const existing = tombstones.get(entry.id);
    if (!existing || existing.updatedAt <= tombstone.updatedAt) {
      tombstones.set(entry.id, tombstone);
    }
  }

  return [...next, ...tombstones.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveResearchAssets(entries: ResearchAssetStoreEntry[]) {
  return entries.filter((entry): entry is ResearchAssetRecord => !isResearchAssetTombstone(entry));
}

function researchAssetTombstones(entries: ResearchAssetStoreEntry[]) {
  return entries.filter(isResearchAssetTombstone);
}

export async function listResearchAssetStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    researchAssets: liveResearchAssets(entries),
    tombstones: researchAssetTombstones(entries),
  };
}

export async function writeResearchAssetsToStore(input: unknown) {
  const normalized = liveResearchAssets(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertResearchAssetInStore(input: unknown) {
  const candidate = normalizeResearchAsset(input);
  if (!candidate) {
    return { researchAsset: null, tombstone: null, accepted: false };
  }

  let storedResearchAsset: ResearchAssetRecord | null = candidate;
  let storedTombstone: ResearchAssetStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existingById = entries.find((entry) => entry.id === candidate.id) ?? null;
    const existingByWorkflow = entries.find(
      (entry): entry is ResearchAssetRecord =>
        !isResearchAssetTombstone(entry) && entry.workflowRunId === candidate.workflowRunId,
    ) ?? null;

    if (
      existingById &&
      (existingById.updatedAt > candidate.updatedAt ||
        (existingById.updatedAt === candidate.updatedAt &&
          isResearchAssetTombstone(existingById)))
    ) {
      accepted = false;
      if (isResearchAssetTombstone(existingById)) {
        storedResearchAsset = null;
        storedTombstone = existingById;
      } else {
        storedResearchAsset = existingById;
      }
      return entries;
    }

    if (
      existingByWorkflow &&
      existingByWorkflow.id !== candidate.id &&
      compareResearchAssetPriority(candidate, existingByWorkflow) <= 0
    ) {
      accepted = false;
      storedResearchAsset = existingByWorkflow;
      storedTombstone = null;
      return entries;
    }

    const replacedEntry =
      existingByWorkflow && existingByWorkflow.id !== candidate.id ? existingByWorkflow : null;
    const replacementTombstone =
      replacedEntry === null
        ? null
        : ({
            id: replacedEntry.id,
            workflowRunId: replacedEntry.workflowRunId,
            updatedAt: candidate.updatedAt,
            deletedAt: candidate.updatedAt,
          } satisfies ResearchAssetStoreTombstone);

    const next = [
      candidate,
      ...(replacementTombstone ? [replacementTombstone] : []),
      ...entries.filter(
        (entry) => entry.id !== candidate.id && entry.id !== replacedEntry?.id,
      ),
    ]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);

    storedResearchAsset =
      next.find(
        (entry): entry is ResearchAssetRecord =>
          entry.id === candidate.id && !isResearchAssetTombstone(entry),
      ) ?? candidate;
    storedTombstone = replacementTombstone;
    return next;
  });

  return { researchAsset: storedResearchAsset, tombstone: storedTombstone, accepted };
}

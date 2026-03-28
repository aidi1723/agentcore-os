import type { BrainDigest, BrainNote } from "@/lib/brain";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const NOTE_FILE_NAME = "brain-notes.json";
const DIGEST_FILE_NAME = "brain-digests.json";
const MAX_NOTES = 240;
const MAX_DIGESTS = 80;

export type BrainNoteStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

export type BrainDigestStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type BrainNoteStoreEntry = BrainNote | BrainNoteStoreTombstone;
type BrainDigestStoreEntry = BrainDigest | BrainDigestStoreTombstone;

function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeBrainNote(input: unknown): BrainNote | null {
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
    title:
      typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名笔记",
    body: typeof item.body === "string" ? item.body : "",
    tags: normalizeTags(item.tags),
    createdAt,
    updatedAt,
  };
}

function normalizeBrainNoteTombstone(input: unknown): BrainNoteStoreTombstone | null {
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

function isBrainNoteTombstone(entry: BrainNoteStoreEntry): entry is BrainNoteStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeBrainNoteEntry(input: unknown): BrainNoteStoreEntry | null {
  return normalizeBrainNoteTombstone(input) ?? normalizeBrainNote(input);
}

function normalizeBrainNoteEntries(raw: unknown): BrainNoteStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, BrainNoteStoreEntry>();
  for (const item of raw) {
    const entry = normalizeBrainNoteEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isBrainNoteTombstone(existing) &&
      isBrainNoteTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_NOTES);
}

function liveBrainNotes(entries: BrainNoteStoreEntry[]) {
  return entries.filter((entry): entry is BrainNote => !isBrainNoteTombstone(entry));
}

function brainNoteTombstones(entries: BrainNoteStoreEntry[]) {
  return entries.filter(isBrainNoteTombstone);
}

function normalizeBrainDigest(input: unknown): BrainDigest | null {
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
    content: typeof item.content === "string" ? item.content : "",
    createdAt,
    updatedAt,
  };
}

function normalizeBrainDigestTombstone(input: unknown): BrainDigestStoreTombstone | null {
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

function isBrainDigestTombstone(
  entry: BrainDigestStoreEntry,
): entry is BrainDigestStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeBrainDigestEntry(input: unknown): BrainDigestStoreEntry | null {
  return normalizeBrainDigestTombstone(input) ?? normalizeBrainDigest(input);
}

function normalizeBrainDigestEntries(raw: unknown): BrainDigestStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, BrainDigestStoreEntry>();
  for (const item of raw) {
    const entry = normalizeBrainDigestEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isBrainDigestTombstone(existing) &&
      isBrainDigestTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_DIGESTS);
}

function liveBrainDigests(entries: BrainDigestStoreEntry[]) {
  return entries.filter((entry): entry is BrainDigest => !isBrainDigestTombstone(entry));
}

function brainDigestTombstones(entries: BrainDigestStoreEntry[]) {
  return entries.filter(isBrainDigestTombstone);
}

export async function listBrainNoteStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(NOTE_FILE_NAME, []);
  const entries = normalizeBrainNoteEntries(raw);
  return {
    notes: liveBrainNotes(entries),
    tombstones: brainNoteTombstones(entries),
  };
}

export async function writeBrainNotesToStore(input: unknown) {
  const normalized = liveBrainNotes(normalizeBrainNoteEntries(input));
  await writeJsonFile(NOTE_FILE_NAME, normalized);
  return normalized;
}

export async function upsertBrainNoteInStore(input: unknown) {
  const candidate = normalizeBrainNote(input);
  if (!candidate) {
    return { note: null, tombstone: null, accepted: false };
  }

  let storedNote: BrainNote | null = candidate;
  let storedTombstone: BrainNoteStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(NOTE_FILE_NAME, [], (current) => {
    const entries = normalizeBrainNoteEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isBrainNoteTombstone(existing)))
    ) {
      accepted = false;
      if (isBrainNoteTombstone(existing)) {
        storedNote = null;
        storedTombstone = existing;
      } else {
        storedNote = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_NOTES);
    storedNote =
      next.find(
        (entry): entry is BrainNote =>
          entry.id === candidate.id && !isBrainNoteTombstone(entry),
      ) ?? candidate;
    storedTombstone = null;
    return next;
  });

  return { note: storedNote, tombstone: storedTombstone, accepted };
}

export async function removeBrainNoteFromStore(noteId: string, updatedAt?: number | null) {
  const normalizedId = noteId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, note: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentNote: BrainNote | null = null;
  let currentTombstone: BrainNoteStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(NOTE_FILE_NAME, [], (current) => {
    const entries = normalizeBrainNoteEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = {
        id: normalizedId,
        updatedAt: deletedAt,
        deletedAt,
      };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_NOTES);
    }

    if (isBrainNoteTombstone(existing)) {
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

    currentNote = existing;

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
      MAX_NOTES,
    );
  });

  return {
    removed,
    conflict,
    note: currentNote,
    tombstone: currentTombstone,
  };
}

export async function listBrainDigestStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(DIGEST_FILE_NAME, []);
  const entries = normalizeBrainDigestEntries(raw);
  return {
    digests: liveBrainDigests(entries),
    tombstones: brainDigestTombstones(entries),
  };
}

export async function writeBrainDigestsToStore(input: unknown) {
  const normalized = liveBrainDigests(normalizeBrainDigestEntries(input));
  await writeJsonFile(DIGEST_FILE_NAME, normalized);
  return normalized;
}

export async function upsertBrainDigestInStore(input: unknown) {
  const candidate = normalizeBrainDigest(input);
  if (!candidate) {
    return { digest: null, tombstone: null, accepted: false };
  }

  let storedDigest: BrainDigest | null = candidate;
  let storedTombstone: BrainDigestStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(DIGEST_FILE_NAME, [], (current) => {
    const entries = normalizeBrainDigestEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isBrainDigestTombstone(existing)))
    ) {
      accepted = false;
      if (isBrainDigestTombstone(existing)) {
        storedDigest = null;
        storedTombstone = existing;
      } else {
        storedDigest = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_DIGESTS);
    storedDigest =
      next.find(
        (entry): entry is BrainDigest =>
          entry.id === candidate.id && !isBrainDigestTombstone(entry),
      ) ?? candidate;
    storedTombstone = null;
    return next;
  });

  return { digest: storedDigest, tombstone: storedTombstone, accepted };
}

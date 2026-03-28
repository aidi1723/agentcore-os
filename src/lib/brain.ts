import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";

export type BrainNote = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type BrainDigest = {
  id: string;
  focus: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type BrainNoteTombstone = SyncTombstoneRecord;
type BrainDigestTombstone = SyncTombstoneRecord;

const NOTES_KEY = "openclaw.brain.notes.v1";
const DIGESTS_KEY = "openclaw.brain.digests.v1";
const MAX_NOTES = 200;
const MAX_DIGESTS = 60;

function normalizeTags(input: string[] | undefined) {
  if (!Array.isArray(input)) return [];
  return input
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 24);
}

function sortNotes(items: BrainNote[]) {
  return items
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_NOTES);
}

function sortDigests(items: BrainDigest[]) {
  return items
    .slice()
    .sort((left, right) => {
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, MAX_DIGESTS);
}

const brainNoteState = createServerBackedListState<BrainNote, BrainNoteTombstone>({
  statusId: "brain-notes",
  statusLabel: "Second Brain 笔记",
  storageKey: NOTES_KEY,
  eventName: "openclaw:brain",
  maxItems: MAX_NOTES,
  listPath: "/api/runtime/state/brain/notes",
  deletePath: (noteId) => `/api/runtime/state/brain/notes/${encodeURIComponent(noteId)}`,
  itemBodyKey: "note",
  sortItems: sortNotes,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { notes?: BrainNote[]; tombstones?: BrainNoteTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.notes) ? payload.data.notes : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { note?: BrainNote | null; tombstone?: BrainNoteTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.note ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

const brainDigestState = createServerBackedListState<BrainDigest, BrainDigestTombstone>({
  statusId: "brain-digests",
  statusLabel: "Second Brain 摘要",
  storageKey: DIGESTS_KEY,
  eventName: "openclaw:brain",
  maxItems: MAX_DIGESTS,
  listPath: "/api/runtime/state/brain/digests",
  itemBodyKey: "digest",
  sortItems: sortDigests,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { digests?: BrainDigest[]; tombstones?: BrainDigestTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.digests) ? payload.data.digests : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            digest?: BrainDigest | null;
            tombstone?: BrainDigestTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.digest ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateBrainFromServer(force = false) {
  await Promise.all([
    brainNoteState.hydrateFromServer(force),
    brainDigestState.hydrateFromServer(force),
  ]);
}

export function getBrainNotes() {
  return brainNoteState.getItems();
}

export function createBrainNote(input?: Partial<Omit<BrainNote, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const note: BrainNote = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "未命名笔记",
    body: input?.body ?? "",
    tags: normalizeTags(input?.tags),
    createdAt: now,
    updatedAt: now,
  };
  brainNoteState.saveLocal([note, ...brainNoteState.load()]);
  brainNoteState.emit();
  void brainNoteState.syncItemToServer(note);
  return note.id;
}

export function updateBrainNote(
  noteId: string,
  patch: Partial<Omit<BrainNote, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  let nextNote: BrainNote | null = null;
  brainNoteState.saveLocal(
    brainNoteState.load().map((note) => {
      if (note.id !== noteId) return note;
      nextNote = {
        ...note,
        ...patch,
        tags: patch.tags ? normalizeTags(patch.tags) : note.tags,
        updatedAt: now,
      };
      return nextNote;
    }),
  );
  brainNoteState.emit();
  if (nextNote) {
    void brainNoteState.syncItemToServer(nextNote);
  }
}

export function removeBrainNote(noteId: string) {
  const current = brainNoteState.load().find((note) => note.id === noteId) ?? null;
  brainNoteState.saveLocal(brainNoteState.load().filter((note) => note.id !== noteId));
  brainNoteState.emit();
  if (current) {
    void brainNoteState.removeItemOnServer(noteId, current.updatedAt);
  }
}

export function getBrainDigests() {
  return brainDigestState.getItems();
}

export function createBrainDigest(input: { focus: string; content: string }) {
  const now = Date.now();
  const digest: BrainDigest = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    createdAt: now,
    updatedAt: now,
    focus: input.focus,
    content: input.content,
  };
  brainDigestState.saveLocal([digest, ...brainDigestState.load()]);
  brainDigestState.emit();
  void brainDigestState.syncItemToServer(digest);
  return digest.id;
}

export function subscribeBrain(listener: Listener) {
  const unsubNotes = brainNoteState.subscribe(listener);
  const unsubDigests = brainDigestState.subscribe(listener);
  return () => {
    unsubNotes();
    unsubDigests();
  };
}

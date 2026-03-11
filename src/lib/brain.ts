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
};

type Listener = () => void;

const NOTES_KEY = "openclaw.brain.notes.v1";
const DIGESTS_KEY = "openclaw.brain.digests.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:brain"));
  }
}

function loadNotes() {
  if (typeof window === "undefined") return [] as BrainNote[];
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BrainNote[]) : [];
  } catch {
    return [];
  }
}

function saveNotes(next: BrainNote[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(next.slice(0, 200)));
  } catch {
    // ignore
  }
}

function loadDigests() {
  if (typeof window === "undefined") return [] as BrainDigest[];
  try {
    const raw = window.localStorage.getItem(DIGESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BrainDigest[]) : [];
  } catch {
    return [];
  }
}

function saveDigests(next: BrainDigest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIGESTS_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getBrainNotes() {
  return loadNotes().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createBrainNote(input?: Partial<Omit<BrainNote, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const note: BrainNote = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "未命名笔记",
    body: input?.body ?? "",
    tags: input?.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  saveNotes([note, ...loadNotes()]);
  emit();
  return note.id;
}

export function updateBrainNote(
  noteId: string,
  patch: Partial<Omit<BrainNote, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  saveNotes(
    loadNotes().map((note) =>
      note.id === noteId
        ? {
            ...note,
            ...patch,
            updatedAt: now,
          }
        : note,
    ),
  );
  emit();
}

export function removeBrainNote(noteId: string) {
  saveNotes(loadNotes().filter((note) => note.id !== noteId));
  emit();
}

export function getBrainDigests() {
  return loadDigests().slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function createBrainDigest(input: { focus: string; content: string }) {
  const digest: BrainDigest = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    focus: input.focus,
    content: input.content,
  };
  saveDigests([digest, ...loadDigests()]);
  emit();
  return digest.id;
}

export function subscribeBrain(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

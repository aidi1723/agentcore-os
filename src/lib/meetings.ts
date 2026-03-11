export type MeetingRecord = {
  id: string;
  title: string;
  participants: string;
  transcript: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const MEETINGS_KEY = "openclaw.meetings.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:meetings"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as MeetingRecord[];
  try {
    const raw = window.localStorage.getItem(MEETINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MeetingRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: MeetingRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEETINGS_KEY, JSON.stringify(next.slice(0, 40)));
  } catch {
    // ignore
  }
}

export function getMeetings() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertMeeting(input: {
  id?: string;
  title: string;
  participants: string;
  transcript: string;
  summary: string;
}) {
  const now = Date.now();
  const current = load();
  const existing = input.id ? current.find((record) => record.id === input.id) : null;
  const nextRecord: MeetingRecord = existing
    ? {
        ...existing,
        ...input,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        title: input.title.trim() || "未命名会议",
        participants: input.participants,
        transcript: input.transcript,
        summary: input.summary,
        createdAt: now,
        updatedAt: now,
      };

  const next = existing
    ? current.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...current];

  save(next);
  emit();
  return nextRecord.id;
}

export function subscribeMeetings(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

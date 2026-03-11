export type RecruitingStage = "sourced" | "screen" | "interview" | "final" | "offer";

export type RecruitingRecord = {
  id: string;
  role: string;
  candidate: string;
  stage: RecruitingStage;
  profile: string;
  notes: string;
  scorecard: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const RECRUITING_KEY = "openclaw.recruiting.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:recruiting"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as RecruitingRecord[];
  try {
    const raw = window.localStorage.getItem(RECRUITING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RecruitingRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: RecruitingRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECRUITING_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getRecruitingRecords() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertRecruitingRecord(input: {
  id?: string;
  role: string;
  candidate: string;
  stage: RecruitingStage;
  profile: string;
  notes: string;
  scorecard: string;
}) {
  const now = Date.now();
  const current = load();
  const existing = input.id ? current.find((record) => record.id === input.id) : null;
  const nextRecord: RecruitingRecord = existing
    ? {
        ...existing,
        ...input,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        role: input.role.trim() || "未命名岗位",
        candidate: input.candidate.trim() || "未命名候选人",
        stage: input.stage,
        profile: input.profile,
        notes: input.notes,
        scorecard: input.scorecard,
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

export function subscribeRecruitingRecords(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

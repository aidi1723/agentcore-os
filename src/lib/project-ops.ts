export type ProjectHealth = "green" | "yellow" | "red";

export type ProjectOpsRecord = {
  id: string;
  project: string;
  owner: string;
  health: ProjectHealth;
  objective: string;
  updates: string;
  blockers: string;
  brief: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const PROJECT_OPS_KEY = "openclaw.project_ops.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:project-ops"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as ProjectOpsRecord[];
  try {
    const raw = window.localStorage.getItem(PROJECT_OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProjectOpsRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: ProjectOpsRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECT_OPS_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getProjectOpsRecords() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertProjectOpsRecord(input: {
  id?: string;
  project: string;
  owner: string;
  health: ProjectHealth;
  objective: string;
  updates: string;
  blockers: string;
  brief: string;
}) {
  const now = Date.now();
  const current = load();
  const existing = input.id ? current.find((record) => record.id === input.id) : null;
  const nextRecord: ProjectOpsRecord = existing
    ? {
        ...existing,
        ...input,
        updatedAt: now,
      }
    : {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        project: input.project.trim() || "未命名项目",
        owner: input.owner.trim(),
        health: input.health,
        objective: input.objective,
        updates: input.updates,
        blockers: input.blockers,
        brief: input.brief,
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

export function subscribeProjectOpsRecords(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

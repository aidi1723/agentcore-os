export type HealthLog = {
  id: string;
  date: string;
  sleepHours: string;
  energy: number;
  symptom: string;
  medication: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const HEALTH_KEY = "openclaw.health.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:health"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as HealthLog[];
  try {
    const raw = window.localStorage.getItem(HEALTH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HealthLog[]) : [];
  } catch {
    return [];
  }
}

function save(next: HealthLog[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HEALTH_KEY, JSON.stringify(next.slice(0, 180)));
  } catch {
    // ignore
  }
}

export function getHealthLogs() {
  return load().slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function createHealthLog(input?: Partial<Omit<HealthLog, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const log: HealthLog = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    date: input?.date ?? new Date().toISOString().slice(0, 10),
    sleepHours: input?.sleepHours ?? "",
    energy: input?.energy ?? 3,
    symptom: input?.symptom ?? "",
    medication: input?.medication ?? "",
    notes: input?.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([log, ...load()]);
  emit();
  return log.id;
}

export function updateHealthLog(
  logId: string,
  patch: Partial<Omit<HealthLog, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((log) =>
      log.id === logId
        ? {
            ...log,
            ...patch,
            updatedAt: now,
          }
        : log,
    ),
  );
  emit();
}

export function removeHealthLog(logId: string) {
  save(load().filter((log) => log.id !== logId));
  emit();
}

export function subscribeHealth(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type SocialAutopilotRecord = {
  id: string;
  title: string;
  audience: string;
  channels: string;
  objective: string;
  sourceContent: string;
  commentsContext: string;
  scheduleNotes: string;
  outputPack: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const SOCIAL_AUTOPILOT_KEY = "openclaw.social_autopilot.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:social-autopilot"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as SocialAutopilotRecord[];
  try {
    const raw = window.localStorage.getItem(SOCIAL_AUTOPILOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SocialAutopilotRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: SocialAutopilotRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOCIAL_AUTOPILOT_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getSocialAutopilotRecords() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSocialAutopilotRecord(
  input?: Partial<Omit<SocialAutopilotRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: SocialAutopilotRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "未命名社媒任务",
    audience: input?.audience ?? "",
    channels: input?.channels ?? "",
    objective: input?.objective ?? "",
    sourceContent: input?.sourceContent ?? "",
    commentsContext: input?.commentsContext ?? "",
    scheduleNotes: input?.scheduleNotes ?? "",
    outputPack: input?.outputPack ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateSocialAutopilotRecord(
  id: string,
  patch: Partial<Omit<SocialAutopilotRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((record) =>
      record.id === id
        ? {
            ...record,
            ...patch,
            updatedAt: now,
          }
        : record,
    ),
  );
  emit();
}

export function removeSocialAutopilotRecord(id: string) {
  save(load().filter((record) => record.id !== id));
  emit();
}

export function subscribeSocialAutopilot(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

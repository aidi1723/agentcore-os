export type PublishJobId = string;

export type PublishPlatformId =
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "storefront";

export type PublishJobStatus = "queued" | "running" | "done" | "error" | "stopped";

export type PublishJobRecord = {
  id: PublishJobId;
  draftTitle: string;
  platforms: PublishPlatformId[];
  status: PublishJobStatus;
  resultText?: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const KEY = "openclaw.publish.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:publish"));
  }
}

function load(): PublishJobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PublishJobRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: PublishJobRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function subscribePublish(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPublishJobs() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createPublishJob(input: {
  draftTitle: string;
  platforms: PublishPlatformId[];
  status?: PublishJobStatus;
}) {
  const now = Date.now();
  const job: PublishJobRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    draftTitle: input.draftTitle,
    platforms: input.platforms,
    status: input.status ?? "queued",
    createdAt: now,
    updatedAt: now,
  };
  const next = [job, ...load()];
  save(next);
  emit();
  return job.id;
}

export function updatePublishJob(jobId: PublishJobId, patch: Partial<Omit<PublishJobRecord, "id" | "createdAt">>) {
  const now = Date.now();
  const next = load().map((j) => (j.id === jobId ? { ...j, ...patch, updatedAt: now } : j));
  save(next);
  emit();
}

export function removePublishJob(jobId: PublishJobId) {
  const next = load().filter((j) => j.id !== jobId);
  save(next);
  emit();
}


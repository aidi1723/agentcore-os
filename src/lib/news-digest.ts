export type NewsDigestRecord = {
  id: string;
  title: string;
  sources: string;
  focus: string;
  audience: string;
  digest: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const NEWS_DIGEST_KEY = "openclaw.news-digest.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:news-digest"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as NewsDigestRecord[];
  try {
    const raw = window.localStorage.getItem(NEWS_DIGEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NewsDigestRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: NewsDigestRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEWS_DIGEST_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getNewsDigests() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createNewsDigest(
  input?: Partial<Omit<NewsDigestRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: NewsDigestRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "Tech digest",
    sources: input?.sources ?? "",
    focus: input?.focus ?? "",
    audience: input?.audience ?? "",
    digest: input?.digest ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateNewsDigest(
  digestId: string,
  patch: Partial<Omit<NewsDigestRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((record) =>
      record.id === digestId
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

export function removeNewsDigest(digestId: string) {
  save(load().filter((record) => record.id !== digestId));
  emit();
}

export function subscribeNewsDigests(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

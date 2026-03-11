export type WebsitePageType = "homepage" | "landing" | "blog" | "product" | "service";

export type WebsiteSeoRecord = {
  id: string;
  brand: string;
  audience: string;
  pageType: WebsitePageType;
  primaryKeywords: string;
  offer: string;
  competitors: string;
  notes: string;
  blueprint: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const WEBSITE_SEO_KEY = "openclaw.website_seo_studio.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:website-seo"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as WebsiteSeoRecord[];
  try {
    const raw = window.localStorage.getItem(WEBSITE_SEO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WebsiteSeoRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: WebsiteSeoRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WEBSITE_SEO_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function getWebsiteSeoRecords() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createWebsiteSeoRecord(
  input?: Partial<Omit<WebsiteSeoRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: WebsiteSeoRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    brand: input?.brand?.trim() || "未命名网站",
    audience: input?.audience ?? "",
    pageType: input?.pageType ?? "homepage",
    primaryKeywords: input?.primaryKeywords ?? "",
    offer: input?.offer ?? "",
    competitors: input?.competitors ?? "",
    notes: input?.notes ?? "",
    blueprint: input?.blueprint ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateWebsiteSeoRecord(
  id: string,
  patch: Partial<Omit<WebsiteSeoRecord, "id" | "createdAt" | "updatedAt">>,
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

export function removeWebsiteSeoRecord(id: string) {
  save(load().filter((record) => record.id !== id));
  emit();
}

export function subscribeWebsiteSeo(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

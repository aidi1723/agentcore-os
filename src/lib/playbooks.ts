import { getJsonFromStorage, setJsonToStorage } from "@/lib/storage";
import type { AppId } from "@/apps/types";

export type PlaybookAction =
  | { type: "open_app"; appId: AppId; label: string }
  | { type: "copy"; text: string; label: string };

export type Playbook = {
  id: string;
  title: string;
  desc: string;
  actions: PlaybookAction[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "openclaw.playbooks.v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:playbooks"));
  }
}

function newId() {
  try {
    return `pb_${crypto.randomUUID()}`;
  } catch {
    return `pb_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

function normalize(playbook: Partial<Playbook>): Playbook | null {
  const title = String(playbook.title ?? "").trim();
  const desc = String(playbook.desc ?? "").trim();
  const actions = Array.isArray(playbook.actions) ? (playbook.actions as PlaybookAction[]) : [];
  if (!title) return null;
  const now = Date.now();
  const createdAt = Number.isFinite(playbook.createdAt) ? Number(playbook.createdAt) : now;
  const updatedAt = Number.isFinite(playbook.updatedAt) ? Number(playbook.updatedAt) : now;
  return {
    id: String(playbook.id ?? newId()),
    title,
    desc,
    actions: actions.filter((a) => a && typeof a === "object" && (a.type === "open_app" || a.type === "copy")),
    createdAt,
    updatedAt,
  };
}

export function loadPlaybooks(): Playbook[] {
  const raw = getJsonFromStorage<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  const list = raw
    .map((x) => normalize(x as any))
    .filter((x): x is Playbook => Boolean(x))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100);
  return list;
}

export function savePlaybooks(next: Playbook[]) {
  setJsonToStorage(STORAGE_KEY, next.slice(0, 100));
  emit();
}

export function subscribePlaybooks(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function upsertPlaybook(playbook: Partial<Playbook>) {
  const normalized = normalize(playbook);
  if (!normalized) return;
  const now = Date.now();
  const list = loadPlaybooks();
  const idx = list.findIndex((p) => p.id === normalized.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...normalized, updatedAt: now };
  } else {
    list.unshift({ ...normalized, createdAt: now, updatedAt: now });
  }
  savePlaybooks(list);
}

export function createPlaybook(input: { title: string; desc: string; actions: PlaybookAction[] }): Playbook | null {
  const now = Date.now();
  const pb: Playbook = {
    id: newId(),
    title: input.title.trim(),
    desc: input.desc.trim(),
    actions: input.actions ?? [],
    createdAt: now,
    updatedAt: now,
  };
  if (!pb.title) return null;
  const list = loadPlaybooks();
  list.unshift(pb);
  savePlaybooks(list);
  return pb;
}

export function deletePlaybook(id: string) {
  const list = loadPlaybooks().filter((p) => p.id !== id);
  savePlaybooks(list);
}

export function importPlaybooksFromText(text: string): { ok: true; imported: number } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const normalized = items.map((x) => normalize(x as any)).filter((x): x is Playbook => Boolean(x));
    if (normalized.length === 0) return { ok: false, error: "No valid playbooks found." };

    const existing = loadPlaybooks();
    const byId = new Map(existing.map((p) => [p.id, p] as const));
    for (const pb of normalized) {
      byId.set(pb.id, { ...pb, id: pb.id || newId(), updatedAt: Date.now() });
    }
    savePlaybooks([...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt));
    return { ok: true, imported: normalized.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, error: msg };
  }
}

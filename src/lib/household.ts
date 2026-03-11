export type FamilyEvent = {
  id: string;
  title: string;
  member: string;
  date: string;
  time: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type HouseholdItem = {
  id: string;
  name: string;
  quantity: string;
  needed: boolean;
  notes: string;
  updatedAt: number;
};

type Listener = () => void;

const EVENTS_KEY = "openclaw.family.events.v1";
const ITEMS_KEY = "openclaw.family.items.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:family"));
  }
}

function loadEvents() {
  if (typeof window === "undefined") return [] as FamilyEvent[];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FamilyEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(next: FamilyEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

function loadItems() {
  if (typeof window === "undefined") return [] as HouseholdItem[];
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HouseholdItem[]) : [];
  } catch {
    return [];
  }
}

function saveItems(next: HouseholdItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getFamilyEvents() {
  return loadEvents().slice().sort((a, b) => {
    const left = `${a.date} ${a.time}`;
    const right = `${b.date} ${b.time}`;
    return left.localeCompare(right);
  });
}

export function createFamilyEvent(input?: Partial<Omit<FamilyEvent, "id" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const event: FamilyEvent = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "新日程",
    member: input?.member ?? "",
    date: input?.date ?? "",
    time: input?.time ?? "",
    notes: input?.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  saveEvents([event, ...loadEvents()]);
  emit();
  return event.id;
}

export function updateFamilyEvent(
  eventId: string,
  patch: Partial<Omit<FamilyEvent, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  saveEvents(
    loadEvents().map((event) =>
      event.id === eventId
        ? {
            ...event,
            ...patch,
            updatedAt: now,
          }
        : event,
    ),
  );
  emit();
}

export function removeFamilyEvent(eventId: string) {
  saveEvents(loadEvents().filter((event) => event.id !== eventId));
  emit();
}

export function getHouseholdItems() {
  return loadItems().slice().sort((a, b) => Number(b.needed) - Number(a.needed));
}

export function createHouseholdItem(input?: Partial<Omit<HouseholdItem, "id" | "updatedAt">>) {
  const item: HouseholdItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: input?.name?.trim() || "新物品",
    quantity: input?.quantity ?? "",
    needed: input?.needed ?? false,
    notes: input?.notes ?? "",
    updatedAt: Date.now(),
  };
  saveItems([item, ...loadItems()]);
  emit();
  return item.id;
}

export function updateHouseholdItem(
  itemId: string,
  patch: Partial<Omit<HouseholdItem, "id" | "updatedAt">>,
) {
  saveItems(
    loadItems().map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...patch,
            updatedAt: Date.now(),
          }
        : item,
    ),
  );
  emit();
}

export function removeHouseholdItem(itemId: string) {
  saveItems(loadItems().filter((item) => item.id !== itemId));
  emit();
}

export function subscribeHousehold(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

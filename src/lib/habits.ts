export type HabitCadence = "daily" | "weekly";

export type HabitRecord = {
  id: string;
  title: string;
  cadence: HabitCadence;
  notes: string;
  streak: number;
  lastCompletedOn: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const HABITS_KEY = "openclaw.habits.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:habits"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as HabitRecord[];
  try {
    const raw = window.localStorage.getItem(HABITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HabitRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: HabitRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HABITS_KEY, JSON.stringify(next.slice(0, 120)));
  } catch {
    // ignore
  }
}

export function getHabits() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createHabit(input?: Partial<Omit<HabitRecord, "id" | "createdAt" | "updatedAt" | "streak" | "lastCompletedOn">>) {
  const now = Date.now();
  const habit: HabitRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "新习惯",
    cadence: input?.cadence ?? "daily",
    notes: input?.notes ?? "",
    streak: 0,
    lastCompletedOn: "",
    createdAt: now,
    updatedAt: now,
  };
  save([habit, ...load()]);
  emit();
  return habit.id;
}

export function updateHabit(
  habitId: string,
  patch: Partial<Omit<HabitRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  save(
    load().map((habit) =>
      habit.id === habitId
        ? {
            ...habit,
            ...patch,
            updatedAt: now,
          }
        : habit,
    ),
  );
  emit();
}

export function removeHabit(habitId: string) {
  save(load().filter((habit) => habit.id !== habitId));
  emit();
}

export function completeHabit(habitId: string, date: string) {
  save(
    load().map((habit) => {
      if (habit.id !== habitId) return habit;
      if (habit.lastCompletedOn === date) return habit;

      const last = habit.lastCompletedOn ? new Date(habit.lastCompletedOn).getTime() : null;
      const current = new Date(date).getTime();
      const step = habit.cadence === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const nextStreak =
        last !== null && Number.isFinite(last) && current - last <= step * 1.5
          ? habit.streak + 1
          : 1;

      return {
        ...habit,
        streak: nextStreak,
        lastCompletedOn: date,
        updatedAt: Date.now(),
      };
    }),
  );
  emit();
}

export function subscribeHabits(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

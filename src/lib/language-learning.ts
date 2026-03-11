export type LanguageLearningLevel = "beginner" | "intermediate" | "advanced";

export type LanguageLearningRecord = {
  id: string;
  title: string;
  nativeLanguage: string;
  targetLanguage: string;
  level: LanguageLearningLevel;
  focus: string;
  goal: string;
  sourceText: string;
  lessonPack: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;

const LANGUAGE_LEARNING_KEY = "openclaw.language-learning.v1";
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:language-learning"));
  }
}

function load() {
  if (typeof window === "undefined") return [] as LanguageLearningRecord[];
  try {
    const raw = window.localStorage.getItem(LANGUAGE_LEARNING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LanguageLearningRecord[]) : [];
  } catch {
    return [];
  }
}

function save(next: LanguageLearningRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_LEARNING_KEY, JSON.stringify(next.slice(0, 80)));
  } catch {
    // ignore
  }
}

export function getLanguageLearningRecords() {
  return load().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createLanguageLearningRecord(
  input?: Partial<Omit<LanguageLearningRecord, "id" | "createdAt" | "updatedAt">>,
) {
  const now = Date.now();
  const record: LanguageLearningRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    title: input?.title?.trim() || "Language practice",
    nativeLanguage: input?.nativeLanguage?.trim() || "中文",
    targetLanguage: input?.targetLanguage?.trim() || "English",
    level: input?.level ?? "beginner",
    focus: input?.focus?.trim() || "daily conversation",
    goal: input?.goal?.trim() || "",
    sourceText: input?.sourceText ?? "",
    lessonPack: input?.lessonPack ?? "",
    createdAt: now,
    updatedAt: now,
  };
  save([record, ...load()]);
  emit();
  return record.id;
}

export function updateLanguageLearningRecord(
  id: string,
  patch: Partial<Omit<LanguageLearningRecord, "id" | "createdAt" | "updatedAt">>,
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

export function removeLanguageLearningRecord(id: string) {
  save(load().filter((record) => record.id !== id));
  emit();
}

export function subscribeLanguageLearning(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

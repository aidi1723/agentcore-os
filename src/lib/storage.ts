export function getJsonFromStorage<T>(
  key: string,
  fallback: T,
  storage: Storage = window.localStorage,
): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJsonToStorage<T>(
  key: string,
  value: T,
  storage: Storage = window.localStorage,
) {
  storage.setItem(key, JSON.stringify(value));
}


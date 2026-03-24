import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

const LOCK_RETRY_MS = 25;
const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 5_000;

function getDataDir() {
  return path.join(process.cwd(), ".openclaw-data");
}

async function ensureDataDir() {
  await mkdir(getDataDir(), { recursive: true });
}

function resolveFile(name: string) {
  return path.join(getDataDir(), name);
}

function resolveBackupFile(name: string) {
  return `${resolveFile(name)}.bak`;
}

function resolveLockFile(name: string) {
  return `${resolveFile(name)}.lock`;
}

function resolveTempFile(name: string) {
  return `${resolveFile(name)}.${process.pid}.${Date.now()}.${Math.random()
    .toString(16)
    .slice(2)}.tmp`;
}

// Per-file async mutex to prevent concurrent read-modify-write races.
const fileLocks = new Map<string, Promise<void>>();

function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(name) ?? Promise.resolve();
  let resolveLock: (() => void) | null = null;
  const next = new Promise<void>((r) => {
    resolveLock = r;
  });
  fileLocks.set(name, next);
  return prev.then(fn).finally(() => {
    resolveLock?.();
    if (fileLocks.get(name) === next) {
      fileLocks.delete(name);
    }
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireCrossProcessLock(name: string) {
  await ensureDataDir();
  const lockFile = resolveLockFile(name);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      const handle = await open(lockFile, "wx");
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, createdAt: Date.now() }),
        "utf8",
      );
      return async () => {
        await handle.close().catch(() => {});
        await rm(lockFile, { force: true }).catch(() => {});
      };
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
      if (code !== "EEXIST") {
        throw error;
      }

      try {
        const info = await stat(lockFile);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          await rm(lockFile, { force: true });
          continue;
        }
      } catch {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out acquiring store lock for ${name}.`);
      }
      await wait(LOCK_RETRY_MS);
    }
  }
}

async function withWriteLock<T>(name: string, fn: () => Promise<T>) {
  return withFileLock(name, async () => {
    const release = await acquireCrossProcessLock(name);
    try {
      return await fn();
    } finally {
      await release();
    }
  });
}

async function parseJsonFile<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

async function readJsonFileUnlocked<T>(name: string, fallback: T): Promise<T> {
  const file = resolveFile(name);
  const backupFile = resolveBackupFile(name);
  try {
    return await parseJsonFile<T>(file);
  } catch {
    try {
      return await parseJsonFile<T>(backupFile);
    } catch {
      return fallback;
    }
  }
}

async function writeJsonFileUnlocked(name: string, value: unknown) {
  await ensureDataDir();
  const file = resolveFile(name);
  const backupFile = resolveBackupFile(name);
  const tempFile = resolveTempFile(name);
  const handle = await open(tempFile, "w");

  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await rename(tempFile, file);
    await copyFile(file, backupFile).catch(() => {});
  } catch (error) {
    await rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  await ensureDataDir();
  return readJsonFileUnlocked(name, fallback);
}

export async function writeJsonFile(name: string, value: unknown) {
  await withWriteLock(name, async () => {
    await writeJsonFileUnlocked(name, value);
  });
}

export async function readModifyWrite<T>(
  name: string,
  fallback: T,
  modify: (current: T) => T | Promise<T>,
): Promise<T> {
  return withWriteLock(name, async () => {
    const current = await readJsonFileUnlocked<T>(name, fallback);
    const next = await modify(current);
    await writeJsonFileUnlocked(name, next);
    return next;
  });
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// We need to mock the data directory for testing
let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "json-store-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;

  // Reset module cache to get fresh state
  const mod = await import("@/lib/server/json-store");
  mod.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("json-store", () => {
  it("reads fallback when file does not exist", async () => {
    const { readJsonFile } = await import("@/lib/server/json-store");
    const result = await readJsonFile("nonexistent.json", { items: [] });
    expect(result).toEqual({ items: [] });
  });

  it("writes and reads back data", async () => {
    const { readJsonFile, writeJsonFile } = await import("@/lib/server/json-store");
    const data = { items: [{ id: "1", name: "test" }] };
    await writeJsonFile("test.json", data);
    const result = await readJsonFile("test.json", { items: [] });
    expect(result).toEqual(data);
  });

  it("readModifyWrite performs atomic update", async () => {
    const { readModifyWrite, readJsonFile } = await import("@/lib/server/json-store");
    await readModifyWrite("counter.json", { count: 0 }, (current) => ({
      count: (current as { count: number }).count + 1,
    }));
    const result = await readJsonFile("counter.json", { count: 0 });
    expect(result).toEqual({ count: 1 });
  });

  it("cache returns same data on repeated reads", async () => {
    const { readJsonFile, writeJsonFile } = await import("@/lib/server/json-store");
    await writeJsonFile("cached.json", { value: 42 });
    const first = await readJsonFile("cached.json", {});
    const second = await readJsonFile("cached.json", {});
    expect(first).toEqual(second);
    expect(first).toEqual({ value: 42 });
  });

  it("invalidateCache forces re-read from disk", async () => {
    const { readJsonFile, writeJsonFile, invalidateCache } = await import("@/lib/server/json-store");
    await writeJsonFile("inv.json", { v: 1 });
    await readJsonFile("inv.json", {});

    // Write directly to disk bypassing the store
    const filePath = path.join(tmpDir, ".openclaw-data", "inv.json");
    await writeFile(filePath, JSON.stringify({ v: 2 }));

    // Without invalidation, cache might still return old value
    invalidateCache("inv.json");
    const result = await readJsonFile("inv.json", {});
    expect(result).toEqual({ v: 2 });
  });
});

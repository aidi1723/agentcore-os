import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildDeliveryDemoData } from "./demo-data.mjs";

const DATA_DIR = ".openclaw-data";

const STORE_FILES = [
  ["controlledRuns", "controlled-execution-runs.json"],
  ["salesAssets", "sales-assets.json"],
  ["knowledgeAssets", "knowledge-assets.json"],
  ["workflowRuns", "workflow-runs.json"],
  ["drafts", "drafts.json"],
  ["supportAssets", "support-assets.json"],
];

function recordKey(record) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.id === "string" && record.id.trim()) return `id:${record.id}`;
  if (typeof record.sourceKey === "string" && record.sourceKey.trim()) {
    return `sourceKey:${record.sourceKey}`;
  }
  return null;
}

function compareByUpdatedAtDesc(left, right) {
  const leftUpdatedAt =
    typeof left.updatedAt === "number" && Number.isFinite(left.updatedAt)
      ? left.updatedAt
      : typeof left.createdAt === "number" && Number.isFinite(left.createdAt)
        ? left.createdAt
        : 0;
  const rightUpdatedAt =
    typeof right.updatedAt === "number" && Number.isFinite(right.updatedAt)
      ? right.updatedAt
      : typeof right.createdAt === "number" && Number.isFinite(right.createdAt)
        ? right.createdAt
        : 0;
  if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt;

  const leftId = typeof left.id === "string" ? left.id : "";
  const rightId = typeof right.id === "string" ? right.id : "";
  return leftId.localeCompare(rightId, "en");
}

export function mergeDeliveryDemoRecords(existingRecords, demoRecords) {
  const byKey = new Map();

  for (const record of Array.isArray(existingRecords) ? existingRecords : []) {
    const key = recordKey(record);
    if (!key) continue;
    byKey.set(key, record);
  }

  for (const record of Array.isArray(demoRecords) ? demoRecords : []) {
    const key = recordKey(record);
    if (!key) continue;
    byKey.set(key, record);
  }

  return Array.from(byKey.values()).sort(compareByUpdatedAtDesc);
}

async function readJsonArray(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${filePath} must contain a JSON array.`);
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeJsonArray(filePath, records) {
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function seedDeliveryDemoData({
  dataDir = path.join(process.cwd(), DATA_DIR),
  now = Date.now(),
} = {}) {
  const data = buildDeliveryDemoData({ now });
  await mkdir(dataDir, { recursive: true });

  const summary = {};
  for (const [dataKey, fileName] of STORE_FILES) {
    const filePath = path.join(dataDir, fileName);
    const existing = await readJsonArray(filePath);
    const next = mergeDeliveryDemoRecords(existing, data[dataKey]);
    await writeJsonArray(filePath, next);
    summary[fileName] = {
      before: existing.length,
      after: next.length,
      seeded: data[dataKey].length,
    };
  }

  return {
    ok: true,
    dataDir,
    summary,
  };
}

async function main() {
  const result = await seedDeliveryDemoData();
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

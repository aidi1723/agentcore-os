import fs from "fs/promises";
import path from "path";
import { OPENCLAW_WORKSPACE } from "@/lib/paths";

export async function readRecentMemoryLines(maxLines = 200) {
  const memDir = path.join(OPENCLAW_WORKSPACE, "memory");

  try {
    const files = (await fs.readdir(memDir))
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.md$/.test(file))
      .sort()
      .slice(-5);

    const chunks = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(memDir, file);
        const text = await fs.readFile(filePath, "utf8");
        const lines = text.split(/\r?\n/).slice(-maxLines).join("\n");
        return `# ${file}\n${lines}`;
      }),
    );

    return { ok: true as const, files, text: chunks.join("\n\n") };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, error: `Failed to read ${memDir}: ${message}` };
  }
}

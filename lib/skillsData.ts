import fs from "fs/promises";
import path from "path";
import { SKILLS_DIR } from "@/lib/paths";

export type SkillInfo = {
  name: string;
  hasSkillMd: boolean;
};

export async function listSkills(): Promise<SkillInfo[]> {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return await Promise.all(
    names.map(async (name) => {
      try {
        await fs.access(path.join(SKILLS_DIR, name, "SKILL.md"));
        return { name, hasSkillMd: true };
      } catch {
        return { name, hasSkillMd: false };
      }
    }),
  );
}

export async function readSkillMarkdown(name: string) {
  const filePath = path.join(SKILLS_DIR, name, "SKILL.md");

  try {
    const markdown = await fs.readFile(filePath, "utf8");
    return { exists: true as const, filePath, markdown };
  } catch {
    return { exists: false as const, filePath, markdown: "" };
  }
}
